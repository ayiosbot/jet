import { AnyInteractionChannel, AnyInteractionGateway, AnyTextableChannel, ApplicationCommandTypes, CommandInteraction, InteractionTypes, Message, MessageFlags, PrivateChannel, Uncached } from 'oceanic.js';
import type Client from './Client';
import CoreMessages from '../databases/messages/Core';
import type Registry from './Registry';
import { Command, CommandCause, CommandContext, CommandResult } from './Command';
import Util from '../Util';

export default class Dispatcher {
    public readonly client: Client;
    public isEnabled: boolean = false;
    public defaultEphemeralState: boolean = false;
    constructor(client: Client) {
        this.client = client;

        const onInteractionCreate = async (interaction: AnyInteractionGateway) => {
            if (!this.isEnabled) return;
            if (!interaction.isCommandInteraction()) return;
            if (interaction.type !== InteractionTypes.APPLICATION_COMMAND) return;
            if (interaction.user.bot) return;
            try {
                const command = this.client.registry.commands.get(interaction.data.name);
                if (!command) {
                    // We simply do not process commands that we do not register.
                    // Also, if some shard released commands, other shards would not have that data.
                    return;
                }
                if (this.client.registry.disabledCommands.has(command.name)) return;
                if (command.guildOnly && !interaction.guildID) return;
                if (command.defer) {
                    await interaction.defer();
                }
                this.preProcessor(command, interaction);
            } catch (error) {
                this.client.emit('error', error as Error);
                this.client.reply(interaction, { content: CoreMessages.DISPATCHER.PROCESS_ERROR })
                    .catch(() => false);
            }
        }
        const onMessageCreate = async (message: Message<AnyTextableChannel | Uncached>) => {
            return; // not implemented
        }
        onInteractionCreate.bind(this);
        onMessageCreate.bind(this);
        this.client.on('interactionCreate', onInteractionCreate);
        // this.client.on('messageCreate', onMessageCreate);
    }
    async preProcessor(command: Command, cause: CommandCause, args?: string[]): Promise<void> {
        // code here
        // typically reserved for "blacklist checks", "premium checks", "get user data", etc
        // This is *just* to fetch data to add onto the context data (e.g. "isPremium": true)
        // const context = new CommandContext({ cause, command });
        this.process(cause, command);
    }
    /**
     * Turn this into a proper command object
     * @param cause 
     * @param data 
     */
    async process(cause: CommandCause, command: Command, data?: any) {
        const context = new CommandContext({ cause, command });
        try {
            context.ephemeral = true;
            // Example usage: Check for blacklists. Return if so
            const cooldown = command.cooldownMap.get(context.user.id);
            if (cooldown && cooldown > Date.now()) {
                const remainingTime = `<t:${Math.floor(cooldown / 1000)}:R>`;
                const error = CoreMessages.COMMAND.COOLDOWN
                    .replace('{remainingTime}', remainingTime);
                return context.reply({ flags: MessageFlags.EPHEMERAL, content: error });
            }

            const [ moduleResult, moduleMessage ] = await command.getModule().preliminaryExecution(context);
            if (!moduleResult) {
                return context.reply({ content: moduleMessage || CoreMessages.MODULE.PRELIM_FAIL })
                    .catch(() => false);
            }

            const [ commandResult, commandMessage ] = await command.preliminaryExecution(context);
            if (!commandResult) {
                return context.reply({ content: moduleMessage || CoreMessages.COMMAND.PRELIM_FAIL })
                    .catch(() => false);
            }


            if (context.guild) {
                // If your bot is public, right below is an ideal time to check for disabled modules, commands, etc
                // set by the guild - not the developers

                // if (context.data.guildSettings.disabledCommands.includes(command.name)) {
                //     return context.reply('Sorry! That command is disabled by a server admin.');
                // }
                // -----------------

                // Permission checks
                try {
                    const result = await this.evaluatePermissions(context);
                    if (typeof result === 'string' || result === false) {
                        return context.reply(CoreMessages.COMMAND.GENERIC_PERMISSION_ERROR).catch(() => false);
                    }
                } catch (error) {
                    return context.reply('An unknown error occurred').catch(() => false);
                }
            }
            context.ephemeral = this.defaultEphemeralState;
            if (cooldown) {
                command.cooldownMap.set(context.user.id, Date.now() + cooldown);

                setTimeout(() => {
                    const currentCooldown = command.cooldownMap.get(context.user.id);
                    if (currentCooldown && Date.now() < currentCooldown) command.cooldownMap.delete(context.user.id);
                }, cooldown);
            }
            try {
                const commandResponse = await command.run(context);
                if (commandResponse === CommandResult.SuccessNoCooldown) {
                    command.cooldownMap.delete(context.user.id);
                }
            } catch {
                // this.client.emit('run')
                // command error or something
            }
        } catch (error) {
            this.client.emit('error', error as Error);
            // todo: Log command (as Error) idk
            if (cause instanceof Message) {
                try {
                    if (cause.inDirectMessageChannel()) {
                        const channel = cause.channel as PrivateChannel || await cause.author.createDM();
                        channel.createMessage({ messageReference: { messageID: cause.id }, content: CoreMessages.DISPATCHER.EXECUTION_ERROR })
                            .catch(() => false);
                    }
                } catch {

                }
            } else {
                cause.reply({ flags: MessageFlags.EPHEMERAL, content: CoreMessages.DISPATCHER.EXECUTION_ERROR })
                    .catch(() => false);
            }
        }
    }
    public evaluatePermissions(context: CommandContext) {
        const formatPermissions = (permissions: string[], referSelf: boolean = false): string => {
            return `In order to run this command, ${referSelf ? 'I' : 'you'} need the ${
                permissions.map(p => `\`${p}\``).join(', ')
            } permission${permissions.length === 0 ? '' : 's'}.`;
        }
        const definedPermissions = context.command.permissions!;
        const authorPermissions = context.guild!.permissionsOf(context.user.id);
        const clientPermissions = context.guild!.permissionsOf(this.client.user.id);

        if (definedPermissions) {
            if (definedPermissions.clientGuild && !clientPermissions.has(definedPermissions.clientGuild!)) {
                return Promise.resolve(formatPermissions(Util.missingStrings(clientPermissions, definedPermissions.clientGuild!), true));
            }
            if (definedPermissions.clientChannel && !clientPermissions.has(definedPermissions.clientChannel!)) {
                return Promise.resolve(formatPermissions(Util.missingStrings(clientPermissions, definedPermissions.clientChannel!), true));
            }
            if (definedPermissions.authorGuild && !authorPermissions.has(definedPermissions.authorGuild!)) {
                return Promise.resolve(formatPermissions(Util.missingStrings(authorPermissions, definedPermissions.authorGuild)));
            }
            if (definedPermissions.authorChannel && !authorPermissions.has(definedPermissions.authorChannel)) {
                return Promise.resolve(formatPermissions(Util.missingStrings(authorPermissions, definedPermissions.authorChannel)));
            }
        }

        return Promise.resolve(true);
    }
}