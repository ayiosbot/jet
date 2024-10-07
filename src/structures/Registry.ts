import { Collection } from '@ayios/collection';
import type Client from './Client';
import { Command, CommandDeployment } from './Command';
import Dispatcher from './Dispatcher';
import Module from './Module';
import { join } from 'path';
import crypto from 'crypto';

/**
 * 
 * Modules should have a name and ID (e.g. [Moderation, mod], [Information, info])
 * 
 * Example:
 * modules/moderation/Module.ts
 * modules/info/Module.ts
 */

export default class Registry {
    public readonly client: Client;
    /**
     * A set of disabled modules.
     * 
     * You should add these BEFORE registering all modules.
     */
    public readonly disabledModules = new Set<string>();
    public readonly disabledCommands = new Set<string>();
    public readonly modules = new Collection<string, Module>();
    public readonly commands = new Collection<string, Command>();
    public readonly commandAliases = new Collection<string, Command>();
    private readonly _moduleDirectory: string;
    constructor(client: Client) {
        this.client = client;
        this._moduleDirectory = join(this.client.root, 'modules');
    }
    /**
     * Returns a hash of all commands. Useful for deploying commands *only* if something
     * has changed to preserve ratelimits.
     * @returns 
     */
    public getHash(): string {
        const hash = this.commands
            .filter(c => c.registry.slash)
            .sort((a, b) => a.name.length - b.name.length)
            .map(c => Command.createHash(c));
        return crypto.createHash('md5').update(hash.join('')).digest('hex');
    }
    /**
     * Find a module by its class or its ID
     * @param module Module ID or object
     * @returns 
     */
    public findModule(module: string | Module): Module | undefined {
        if (typeof module === 'string') {
            return this.modules.get(module);
        } else return module;
    }
    //> REGISTER ITSELF COMPLELY HANDLES LOADING MODULES
    //> MODULES ONLY HANDLE THEMSELVES
    public async registerModule(module: string | Module): Promise<void> {
        try {
            let foundModule = this.findModule(module);
            if (!foundModule) {
                const path = join(this._moduleDirectory, module as string, 'Module.js');
                const ModuleClass = require(path);
                foundModule = new ModuleClass(this.client) as Module;
            }

            // if disabled, dont do
            if (this.disabledModules.has(foundModule.id)) throw new Error('Attempt to load disabled module');

            this.modules.set(foundModule.id, foundModule);
            await foundModule.onRegister();
            await foundModule.loadCommands();
            await foundModule.loadEvents();
            for (const event of foundModule.events.values()) {
                if (!event.listener) event.createListener();
                if (event.once) {
                    this.client.once(event.type, event.listener!);
                } else this.client.on(event.type, event.listener!);
            }
                
            // Load events then commands
            // todo: If module onLoad fails to work, then do... something
            await foundModule.onLoad(); // Pointless to load an already loaded module
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }
    /**
     * Reloads a module
     * @param module The module to reload
     */
    public async reloadModule(module: string | Module): Promise<Module> {
        const foundModule = this.findModule(module);
        if (!foundModule) return Promise.reject('Module does not exist');
        const moduleID = foundModule.id;
        const modulePath = foundModule.rootDirectory;
        await foundModule.onReload();
        // call private _unloadModule
        await foundModule.onUnload();
        return foundModule.onReload();
    }
    private async _unloadModule(module: Module, isReloading: boolean) {

    }
    /** Unload a module */
    public async unloadModule(module: string | Module): Promise<void> {
        const foundModule = this.findModule(module);
        if (!foundModule) return Promise.reject('Module does not exist');
        return foundModule.onUnload();
    }
    public async registerCommands(validator: (command: Command) => Promise<boolean>) {
        // go through commands
        // validator(command).then(register).catch(() => {})
    }
    async deploySlashCommands(location: CommandDeployment, commands?: Command[]): Promise<void> {
        // todo: redo deploy slash
        // todo: client event 'onDeployment' or smth
        return new Promise(async (resolve, reject) => {
            commands = (commands || location === CommandDeployment.Global
                ? this.client.registry.commands.filter(c => !c.registry!.prefix && !c.rollout)
                : this.client.registry.commands.filter(c => !!c.guildOnly && !!c.rollout)).filter(c => !this.disabledCommands.has(c.name));

            if (location === CommandDeployment.Global) {
                try {
                    const publishedCommands = await this.client.application.bulkEditGlobalCommands(commands.map(c => Command.toSlash(c)));
                    // this.Logger.info(`Published ${chalk.yellow(publishedCommands.length)} global commands.`);
                    return resolve();
                } catch (error) {
                    return reject(error);
                }
            } else {
                /** <guildId, commands[]> */
                const guilds = new Map<string, Command[]>();
                commands.forEach(command => {
                    command.rollout!.forEach(guildId => {
                        const toSet = guilds.get(guildId);
                        // console.log('set', toSet[0].name)
                        guilds.set(guildId, toSet ? [ ...new Set([ ...toSet, command ]) ] : [ command ]);
                    });
                });

                const list = [];
                for (const [ guildId, commandArray ] of guilds.entries()) {
                    const applicationCommands = commandArray.map(c => Command.toSlash(c));
                    list.push(new Promise<void>(async (_resolve, _reject) => {
                        try {
                            const publishedCommands = await this.client.application.bulkEditGuildCommands(guildId, applicationCommands);
                            // this.Logger.info(`Published ${chalk.yellow(publishedCommands.length)} guild commands for ${guildId}`);
                            _resolve();
                        } catch (error) {
                            // Sentry.captureException(error);
                            // this.Logger.error(`Failed to publish guild commands for '${guildId}': ${error}`);
                            // _reject(error);
                            _resolve();
                        }
                    }));
                }

                Promise.all(list).then(() => {
                    // this.Logger.info(`Published all guild commands`);
                    resolve();
                }).catch(reject);
            }
        })
    }
}