import { Collection } from '@ayios/collection';
import { Command, CommandContext, CommandResult } from './Command';
import Event from './Event';
import { join } from 'path';
import fs from 'fs/promises';
import Client from './Client';

export interface ModuleOptions {
    /** Always load commands? */
    commands: boolean;
    /** Always load events? */
    events: boolean;
}

export default class Module {
    /**
     * Developer-set module options (if desired)
     */
    public readonly options: ModuleOptions = { commands: true, events: true };
    public readonly client: Client;
    public readonly id: string;
    /** Name should be defined by the developer */
    public readonly name!: string;
    /** Indexed by command name */
    public readonly commands = new Collection<string, Command>();
    /** ['w' from 'whois']: WhoisCommand (example) */
    public readonly commandAliases = new Collection<string, Command>();
    public readonly events = new Collection<string, Event<any>>();
    public readonly guarded: boolean = false;
    /** Module file system path */
    public readonly rootDirectory: string;
    public readonly eventDirectory: string;
    public readonly commandsDirectory: string;
    public readonly version: string = '0.0.0';
    constructor(id: string, client: Client, fsPath: string) {
        this.id = id;
        this.client = client;
        this.rootDirectory = fsPath;
        this.eventDirectory = join(fsPath, '..', 'events');
        this.commandsDirectory = join(fsPath, '..', 'commands');
    }
    // todo: implement onLoad, onUnload, onReload; onRegister, onUnregister
    // todo: The module handles command unloading OR registry handles command unloading? I doubt theres some specific thing to do, so...
    /**
     * Executes a function after the module is registered.
     * 
     * At this stage, no commands or events will be available until this function is completed.
     * @returns
     */
    public async onRegister(): Promise<void> {
        return Promise.resolve();
    }
    /**
     * Executes a function before the module is unregistered. Until this finishes, the module will still be in the registry.
     * 
     * All commands and events will be loaded until this function resolves.
     * @returns
     */
    public async onUnregister(): Promise<void> {
        return Promise.resolve();
    }
    public async onLoad(): Promise<void> {
        // Load all commands and events
        return Promise.resolve();
    }
    /**
     * Functions for a module to handle on reload. Both "onReload" and "unUnload" will fire.
     * 
     * Keep both of these functions somewhat separate from each other.
     */
    public async onReload(): Promise<Module> {
        return Promise.resolve(this);
    }
    public async onUnload(): Promise<void> {
        return Promise.resolve();
    }
    public async preliminaryExecution(context: CommandContext): Promise<[result: boolean, message?: string]> {
        return Promise.resolve([ true ]);
    }
    /**
     * Does stuff after a command successfully executes. Usually used for logging
     * @param context Command context
     * @param result The result of the command
     */
    public async postliminaryExecution(context: CommandContext, result: CommandResult): Promise<void> {
        return Promise.resolve();
    }
    /**
     * Forcibly load events under the module. Not recommended
     * 
     * This is called internally, however is available if needed.
     * @param validator A validator that verifies if the event should be loaded. Explicitly return false to invalidate.
     */
    public async loadEvents(validator?: (event: any) => boolean | void): Promise<void> {
        if (!validator) validator = () => true;
        await this._scanDir(this.eventDirectory, file => {
            if (file.endsWith('.js')) {
                const eventFile = require(file);
                const event = new eventFile(this.client) as Event<any>;
                if (validator(event) === false) return;

                this.events.set(event.id, event);
                this.client.emit('eventRegister', event, false);
            }
        });
        return Promise.resolve();
    }
    /**
     * Forcibly load commands under the module. Not recommended
     * @param validator A validator that verifies if the command should be loaded. Explicitly return false to invalidate.
     */
    public async loadCommands(validator?: (command: Command) => boolean | void): Promise<void> {
        if (!validator) validator = () => true;
        await this._scanDir(this.commandsDirectory, file => {
            if (file.endsWith('.js')) {
                const commandFile = require(file);
                const command = new commandFile(this.client) as Command;
                if (validator(command) === false) return;
                if (this.client.registry.disabledCommands.has(command.name)) return;

                this.commands.set(command.name, command);
                this.client.registry.commands.set(command.name, command);
                command.aliases?.forEach(alias => {
                    this.commandAliases.set(alias, command);
                    this.client.registry.commandAliases.set(alias, command);
                });
                this.client.emit('commandLoad', command, false);
            }
        });
        return Promise.resolve();
    }
    public async loadCommand(targetCommand: string | Command): Promise<Command> {
        // todo: implement
        // later, redirect loadCommands to call this explicit function
        return targetCommand as Command;
    }
    public async unloadCommand(command: Command): Promise<void> {

    }
    private async _scanDir(dir: string, fileCallback: (path: string) => void): Promise<void> {
        for (const path of await fs.readdir(dir)) {
            const file = join(dir, path);
            const type = await fs.stat(file);

            if (type.isFile()) {
                fileCallback(file);
                continue;
            } else if (type.isDirectory()) return this._scanDir(file, fileCallback);
        }
        return Promise.resolve();
    }
}