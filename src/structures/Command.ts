import {
    AnyInteractionChannel, AnyTextableChannel, ApplicationCommandOptionTypes, ApplicationCommandTypes, Attachment, Channel,
    ChannelTypes, ChatInputApplicationCommand, CommandInteraction, CreateApplicationCommandOptions, CreateChatInputApplicationCommandOptions, CreateMessageOptions, Guild, InteractionContent,
    InteractionOptionsWrapper, InteractionTypes, Member, Message, MessageFlags, Role,
    SubCommandArray, Uncached, User
} from 'oceanic.js';
import Client from './Client';
import crypto from 'crypto';
import Dispatcher from './Dispatcher';
import Logger from '@ayios/logger';
import Module from './Module';
import Registry from './Registry';
import { CachedCollection } from '@ayios/collection';

/** A result telling the system if a command was run successfully or not. */
export enum CommandResult {
    /** The command was run successfully. If cooldown, use it */
    Success,
    SuccessNoCooldown,
    /** A non "command-fatal" error occurred */
    PartialError,
    /** The command experienced a "command-fatal" error */
    Error,
}

export enum CommandDeployment {
    Global,
    Guild
}

export enum CommandType {
    PREFIX,
    SLASH,
    /** Prefix AND Slash */
    INPUT,
    CONTEXT_MESSAGE,
    CONTEXT_USER
}

export enum ContextType {
    PREFIX = 0,
    INTERACTION = 1
}

export enum ArgumentType {
    /**
     * Return attachment info.
     * @warning Recommended for slash commands only.
     * @important This will return the attachment[0] link if used with chat commands.
    */
    ATTACHMENT,
    BOOLEAN,
    CHANNEL,
    INTEGER,
    /** Users and roles only. Will never resolve to a GuildMember */
    MENTIONABLE,
    NUMBER,
    ROLE,
    STRING,
    SUB_COMMAND, 
    SUB_COMMAND_GROUP,
    USER
}

export type CommandCause = Message<AnyTextableChannel | Uncached> | CommandInteraction<AnyInteractionChannel | Uncached, ApplicationCommandTypes>;

// Must register groups before commands
export interface CommandDefinition {
    name: string;
    slashName?: string;
    nameLocalizations?: Record<string, string>;
    aliases?: string[];
    description?: string;
    descriptionLocalizations?: Record<string, string>;
    module: string;
    /**
     * @custom This is a custom property.
     * This is a boolean to allow the command to be disabled by guild owners.
     * 
     * You must implement this feature yourself.
     */
    guarded?: boolean;
    nsfw?: boolean;
    guildOnly?: boolean;
    cooldown?: number;
    /** How many milliseconds before the command handler stops waiting for a result */
    timeout?: number;
    timeoutResult?: CommandResult;
    /** Unique guild IDs to roll the command out to when ready */
    rollout?: string[];
    arguments?: CommandArgument[];
    slashArguments?: CommandArgument[];
    prefixArguments?: CommandArgument[];
    /** None of this is evaluated for a DM channel. */
    permissions?: {
        /** Determines if the client has `clientGuild` permissions in the current guild. */
        clientGuild?: bigint;
        /** Determines if the client has `clientChannel` permissions in the current channel. */
        clientChannel?: bigint;
        /** Determines if the author has `authorGuild` permissions in the current guild. */
        authorGuild?: bigint;
        /** Determines if the author has `authorChannel` permissions in the current channel. */
        authorChannel?: bigint;
    };
    example?: string[] | { prefix?: string[]; slash?: string[]; };
    /** Defaults to slash true */
    registry?: {
        prefix?: boolean;
        slash?: boolean;
        message?: boolean;
        user?: boolean;
    }
}


export interface CommandArgumentInput {
    type: ArgumentType;
    name: string;
    value: any;
}


export namespace Arguments {
    export type ArgumentChoices = { name: string, value: string}[];
    export interface SubcommandGroupCommandArgument extends BaseInputCommandArgument {
        type: ArgumentType.SUB_COMMAND_GROUP;
        /** What other subcommands are there? */
        arguments: SubcommandCommandArgument[];
    }
    export interface SubcommandCommandArgument extends BaseInputCommandArgument {
        type: ArgumentType.SUB_COMMAND;
        /** What other arguments are threre? */
        arguments?: CommandArgument[];
    }
    export interface AttachmentCommandArgument extends BaseInputCommandArgument {
        type: ArgumentType.ATTACHMENT;
    }
    export interface ChannelCommandArgument extends BaseInputCommandArgument {
        type: ArgumentType.CHANNEL;
        /** Unique valid channel types */
        channelTypes?: ChannelTypes;
    }
    export interface BooleanCommandArgument extends BaseInputCommandArgument {
        type: ArgumentType.BOOLEAN;
    }
    export interface RoleCommandArgument extends BaseInputCommandArgument {
        type: ArgumentType.ROLE;
    }
    export interface MentionableCommandArgument extends BaseInputCommandArgument {
        type: ArgumentType.MENTIONABLE;
    }
    export interface UserCommandArgument extends BaseInputCommandArgument {
        type: ArgumentType.USER;
    }
    export interface NumberCommandArgument extends BaseInputCommandArgument {
        type: ArgumentType.NUMBER;
        /** Whether the argument is autocomplete */
        autocomplete?: boolean;
        /** Minimum value */
        minValue?: number;
        /** Maximum value */
        maxValue?: number;
    }
    export type IntegerCommandArgument = NumberCommandArgument;
    export interface StringCommandArgument extends BaseInputCommandArgument {
        type: ArgumentType.STRING;
        /** Whether the argument is autocomplete */
        autocomplete?: boolean;
        /** The minimum length for the string */
        minLength?: number;
        /** The maximum length for the string */
        maxLength?: number;
        choices?: ArgumentChoices;
    }
    export interface BaseInputCommandArgument extends BaseCommandArgument {
        /** Whether the argument is optional */
        optional?: boolean;
        /** Command argument type */
        type: ArgumentType;
    }
    export interface BaseCommandArgument {
        /** Argument name */
        name: string;
        /** Localization options for argument name */
        nameLocalizations?: Record<string, string>;
        /** Argument description */
        description: string;
        /** Localization options for argument description */
        descriptionLocalizations?: Record<string, string>;
        /** What should show to the user if validation fails or if the argument is missing */
        errorMessage?: string;
    }
    export type CommandArgument = StringCommandArgument | RoleCommandArgument | UserCommandArgument | NumberCommandArgument
        | IntegerCommandArgument | MentionableCommandArgument | BooleanCommandArgument | SubcommandCommandArgument
        | SubcommandGroupCommandArgument | ChannelCommandArgument | AttachmentCommandArgument;
}
// Shorthand
export type CommandArgument = Arguments.CommandArgument;

export class ArgumentSelector {
    public readonly type: CommandType;
    public readonly client: Client;
    private readonly int?: CommandInteraction;
    private readonly message?: Message;
    private args: CommandArgumentInput[] = [];
    constructor(client: Client, interaction: CommandInteraction | undefined, message: Message | undefined, argData: CommandArgumentInput[] | undefined) {
        this.client = client;
        if (interaction) {
            this.int = interaction;
            if (interaction.isMessageCommand()) {
                this.type = CommandType.CONTEXT_MESSAGE;
            } else if (interaction.isUserCommand()) {
                this.type = CommandType.CONTEXT_USER;
            } else if (interaction.isChatInputCommand()) {
                this.type = CommandType.SLASH;
            } else throw new TypeError(`Unrecognized interaction type for ArgumentSelector: ${interaction.type}`);
        } else {
            if (!message) throw new Error('ArgSelector constructed with no message');
            this.type = CommandType.PREFIX;
            this.message = message;
        }
    }
    private search(name: string, type: ArgumentType) {
        return this.args.find(a => a.name === name && a.type === ArgumentType.ATTACHMENT);
    }
    /**
     * 
     * @param name 
     * @returns Attachment
     */
    getAttachment(name: string): Attachment | undefined {
        if (this.type === CommandType.PREFIX) {
            // const result = this.args.find(a => a.name === name && a.type === ArgumentType.ATTACHMENT);
            throw new Error('Not implemented: Prefix command attachments');
            // return '' as any;
        } else if (this.type === CommandType.SLASH) {
            return this.int!.data.options.getAttachment(name);
        }
    }
    getBoolean(name: string): boolean | undefined {
        if (this.type === CommandType.SLASH) {
            return this.int!.data.options.getBoolean(name);
        }
        const data = this.search(name, ArgumentType.BOOLEAN)?.value;
        if (data === undefined) return undefined;
        if (data === 'y' || data === 'yes' || data === 'true' || data === true) {
            return true;
        }
        return false;
    }
    getCompleteChannel(name: string): Channel | undefined {
        // search cache for channel
        if (this.type === CommandType.SLASH) {
            return this.int!.data.options.getCompleteChannel(name);
        }
        const data = this.search(name, ArgumentType.CHANNEL)?.value;
        if (data === undefined) return;
        // todo: validate and pass args
        // const matches = CHANNEL_REGEX.exec(data);
        // if (!matches) return undefined;
        return this.client.getChannel(data);
    }
    getInteger(name: string): number | undefined {
        if (this.type === CommandType.SLASH) {
            return this.int!.data.options.getInteger(name);
        }
        const data = this.search(name, ArgumentType.INTEGER)?.value;
        if (data === undefined) return;
        const transformed = Number(data);
        if (isNaN(transformed) || transformed === Infinity) return;
        return transformed;
    }
    getNumber(name: string): number | undefined {
        if (this.type === CommandType.SLASH) {
            return this.int!.data.options.getInteger(name);
        }
        const data = this.search(name, ArgumentType.INTEGER)?.value;
        if (data === undefined) return;
        const transformed = Number(data);
        if (isNaN(transformed) || transformed === Infinity) return;
        return transformed;
    }
    getMember(name: string): Member | undefined {
        if (this.type === CommandType.SLASH) {
            return this.int!.data.options.getMember(name);
        }
        const user = this.getUser(name); // todo: member/user is not always defined D:
        if (!user) return;

        const member = this.message!.guild!.members.get(user.id);
        return member;
    }
    getMentionable<T extends User | Role = User | Role>(name: string): T | undefined {
        // user or role
        if (this.type === CommandType.SLASH) {
            return this.int!.data.options.getMentionable(name);
        }
        const item = this.args.find(i => i.name === name && [ ArgumentType.USER, ArgumentType.ROLE ].includes(i.type))?.value;
        if (!item) return;
        return item as T;
    }
    getRole(name: string): Role | undefined {
        if (this.type === CommandType.SLASH) {
            return this.int?.data.options.getRole(name);
        }
        const role = this.search(name, ArgumentType.ROLE)?.value;
        return role;
    }
    getString<T extends string = string>(name: string): T | undefined {
        if (this.type === CommandType.SLASH) {
            return this.int!.data.options.getString(name);
        }
        return this.search(name, ArgumentType.STRING)?.value;
    }
    getUser(name: string): User | undefined {
        if (this.type === CommandType.SLASH) {
            return this.int?.data.options.getUser(name);
        }
        return this.search(name, ArgumentType.USER)?.value;
    }
    getSubCommand<T extends SubCommandArray = SubCommandArray>(): T | undefined {
        if (this.type === CommandType.SLASH) {
            return this.int?.data.options.getSubCommand();
        }
        const subcommandGroup = this.search('', ArgumentType.SUB_COMMAND_GROUP)?.value;
        const subcommand = this.search('', ArgumentType.SUB_COMMAND)?.value;
        return [ subcommandGroup, subcommand ] as T;
    }
}

export interface CommandContextOptions<T = any> {
    cause: CommandCause;
    command: Command;
    data?: T;
    // guildData?: GuildSchema;
    // premiumData?: PremiumKeySchema;
    // userData?: UserSchema;
}

export class CommandContext<T = any> {
    /**
     * Boolean indicating if replies should be ephemeral.
     * @important Overriden if flags are already in the payload.
     */
    private readonly _isEphemeral: boolean = false;
    public get ephemeral() {
        return this._isEphemeral;
    }
    public set ephemeral(value: boolean) {
        Object.defineProperty(this, '_isEphemeral', { value });
    }
    public readonly cause: CommandInteraction | Message;
    public readonly type: ContextType;
    public readonly arguments: InteractionOptionsWrapper | ArgumentSelector;
    public readonly user: User;
    public readonly member: Member | undefined;
    public readonly guild: Guild | undefined;
    public readonly command: Command;
    public readonly data: T;
    public readonly channel: AnyTextableChannel | undefined
    // public readonly premiumData: PremiumKeySchema | undefined;
    // public readonly userData: UserSchema | undefined;
    /** Undefined if DM command */
    // public readonly guildData: GuildSchema | undefined;
    // constructor(interaction: CommandInteraction<AnyInteractionChannel | Uncached, ApplicationCommandTypes> | Message, argData: CommandArgumentInput) {
    constructor(options: CommandContextOptions<T>) {
        this.cause = options.cause;
        this.data = options.data as T;
        this.command = options.command;
        this.type = this.cause instanceof Message ? ContextType.PREFIX : ContextType.INTERACTION;
        // this.guildData = options.guildData;
        // this.premiumData = options.premiumData;
        // this.userData = options.userData;
        this.channel = this.cause.channel as AnyTextableChannel;

        if (this.cause.guild) this.guild = this.cause.guild;
        // interaction.channel
        // interaction.client.regi
        if (this.type === ContextType.INTERACTION) {
            if (this.cause.type !== InteractionTypes.APPLICATION_COMMAND) throw new Error('Interaction type is not an application command');
            this.arguments = (this.cause as CommandInteraction).data.options as InteractionOptionsWrapper;
            this.user = this.cause.user;
            this.member = this.cause.member ?? undefined;
        } else { // Prefix command.
            throw new Error('Not implemented');
            // this.arguments = new ArgumentSelector(this.cause.client, undefined, this.cause as Message, [
                
            // ]);
        }
        // this.arguments.
        // todo: do a thing with InteractionOptionsWrapper
        // interaction?.reply()
        // this.reply({})
    }
    /** Basically just object.assign */
    public setOptions(options: CommandContextOptions) {
        Object.assign(this, options);
    }
    // public async fetchGuild<T>() {
    //     return this.cause.client.DataProvider.guilds.fetch<T>(this.guild!.id, { cacheAfter: true, callIfNotCached: true });
    // }
    // public async fetchPremium() {
    //     if (!this.guild) throw new Error('Cannot fetch premium for a non-guild');
    //     return this.cause.client.DataService.guild.premium.getPremium(this.guild.id, true, true);
    //     // return this.cause.client.DataProvider.guilds.fetchPremium(this.guild.id)
    // }
    public async reply(message: string | InteractionContent, doEdit: boolean = false) {
        // todo: ALLOWED MENTIONS
        const payload: CreateMessageOptions = typeof message === 'string' ? { content: message } : message as InteractionContent;
        // payload.messageReference
        if (this.cause instanceof Message) {
            payload.messageReference = { messageID: this.cause.id };
            const channel = this.cause.client.privateChannels.get(this.cause.channelID)
            if (!this.channel || !channel) { // It's a DM channel
                try {
                    const dmChannel = await this.cause.author.createDM();
                    return dmChannel.createMessage(payload);
                } catch (error) {
                    return Promise.reject(error);
                }
            } else return this.cause.channel!.createMessage(payload);
        } else {
            if (this.ephemeral) {
                if (payload.flags) {
                    payload.flags += MessageFlags.EPHEMERAL;
                } else payload.flags = MessageFlags.EPHEMERAL;
            }
            if (doEdit) {
                return this.cause.editOriginal(payload);
            } else {
                if (this.cause.acknowledged) {
                    // Safe reply if it's acknowledged.
                    return this.cause.editOriginal(payload);
                }
                return this.cause.reply(payload);
            }
        }
    }
}

export class Command implements Partial<CommandDefinition> {
    public readonly client: Client;
    public readonly name: string;
    public readonly slashName?: string;
    public readonly aliases?: string[] | undefined;
    public readonly nameLocalizations?: Record<string, string> | undefined;
    public readonly description: string | undefined;
    public readonly descriptionLocalizations?: Record<string, string> | undefined;
    public readonly registry!: { prefix?: boolean; slash?: boolean; message?: boolean; user?: boolean; };
    public readonly permissions!: { clientGuild?: bigint; clientChannel?: bigint; authorGuild?: bigint; authorChannel?: bigint; } | undefined;
    public readonly arguments?: Arguments.CommandArgument[] | undefined;
    public readonly slashArguments?: Arguments.CommandArgument[] | undefined;
    public readonly prefixArguments?: Arguments.CommandArgument[] | undefined;
    public readonly cooldown?: number | undefined;
    public readonly example?: string[] | { prefix?: string[]; slash?: string[]; } | undefined;
    public readonly guarded?: boolean | undefined;
    public readonly rollout?: string[] | undefined;
    public readonly timeout?: number | undefined;
    public readonly timeoutResult?: CommandResult | undefined;
    public readonly guildOnly?: boolean | undefined;
    public readonly nsfw?: boolean | undefined;
    public readonly module!: string;
    public readonly _filename: string;
    /** <user_id>: expires_at */
    public readonly cooldownMap = new CachedCollection<string, number>(1000);
    constructor(client: Client, definition: CommandDefinition, filename: string) {
        this.client = client;
        this._filename = filename;
        this.name = definition.name;
        this.slashName = definition.slashName || definition.name;
        Object.assign(this, definition);
        if (definition.cooldown) this.cooldownMap.defaultMs = definition.cooldown * 2;
        if (!definition.registry) this.registry = { slash: true };
        if (!definition.name) throw new Error(`Command ${filename} requires a name`);
        if (!definition.description && (this.registry.slash || this.registry.prefix)) {
            throw new Error(`Missing command description for ${this.module}:${this.name}`);
        }
        if (!definition.module) throw new Error(`Missing module for command ${this.name}; ${filename}`);
        if (definition.arguments) {
            // We have arguments, so assign them appropriately
            if (this.registry.slash && !definition.slashArguments) {
                this.slashArguments = definition.arguments;
            }
            if (this.registry.prefix && !definition.prefixArguments) {
                this.prefixArguments = definition.arguments;
            }
        }
        // todo: add explicit redirection for run, runPrefix, and runSlash functions
        // if both, then it uses run, unless explicitly clarified
        if (this.prefixArguments && !this.registry.prefix) {
            Logger.warn('Command has prefix arguments despite registry override');
        }
        if (this.slashArguments && !this.registry.slash) {
            Logger.warn('Command has slash arguments despite registry override');
        }
    }
    public getModule(): Module {
        return this.client.registry.modules.get(this.module)!;
    }
    public async preliminaryExecution(context: CommandContext): Promise<[result: boolean, message?: string]> {
        return Promise.resolve([ true ]);
    }
    public async postliminaryExecution(context: CommandContext, result: CommandResult): Promise<void> {
        return Promise.resolve();
    }
    public async run(context: CommandContext): Promise<CommandResult> {
        throw new Error(`No run function implemented for command ${this.module}:${this.name}`);
    }
    public getType(): ApplicationCommandTypes {
        if (this.registry.user) {
            return ApplicationCommandTypes.USER;
        } else if (this.registry.message) {
            return ApplicationCommandTypes.MESSAGE;
        } else if (this.registry.slash) {
            return ApplicationCommandTypes.CHAT_INPUT;
        }
        throw new Error('Unrecognized type');
    }
    public static toSlash(command: Command): CreateApplicationCommandOptions {
        if (!command.registry.slash && !command.registry.message && !command.registry.user) {
            throw new Error(`Command ${command.module}:${command.name} has no slash or context command support.`);
        }

        let options: CreateApplicationCommandOptions = {
            name: command.slashName!,
            description: command.description!,
            dmPermission: !command.guildOnly,
            type: command.getType()
        }
        if (command.nsfw) options.nsfw = true;
        if (command.nameLocalizations) options.nameLocalizations = command.nameLocalizations;
        if (command.descriptionLocalizations) {
            (options as CreateChatInputApplicationCommandOptions).descriptionLocalizations = command.descriptionLocalizations;
        }
        if (command.permissions && Object.hasOwn(command.permissions, 'authorGuild')) {
            options.defaultMemberPermissions = String(command.permissions.authorGuild!);
        }
        if (command.arguments) {
            (options as CreateChatInputApplicationCommandOptions).options = [];
            if (command.arguments.length < 0) return options;
            const enumMap = [
                [ ArgumentType.ATTACHMENT,        ApplicationCommandOptionTypes.ATTACHMENT        ],
                [ ArgumentType.BOOLEAN,           ApplicationCommandOptionTypes.BOOLEAN           ],
                [ ArgumentType.CHANNEL,           ApplicationCommandOptionTypes.CHANNEL           ],
                [ ArgumentType.INTEGER,           ApplicationCommandOptionTypes.INTEGER           ],
                [ ArgumentType.MENTIONABLE,       ApplicationCommandOptionTypes.MENTIONABLE       ],
                [ ArgumentType.NUMBER,            ApplicationCommandOptionTypes.NUMBER            ],
                [ ArgumentType.ROLE,              ApplicationCommandOptionTypes.ROLE              ],
                [ ArgumentType.STRING,            ApplicationCommandOptionTypes.STRING            ],
                [ ArgumentType.SUB_COMMAND,       ApplicationCommandOptionTypes.SUB_COMMAND       ],
                [ ArgumentType.SUB_COMMAND_GROUP, ApplicationCommandOptionTypes.SUB_COMMAND_GROUP ],
                [ ArgumentType.USER,              ApplicationCommandOptionTypes.USER              ]
            ]
            const apply = (arg: any, option: any) => {
                if (!arg.type) throw new Error(`Argument ${arg.name} of ${command.name} has no type.`);
                option.name = arg.name;
                option.description = arg.description;
                enumMap.forEach(([commandType, oceanicType]) => {
                    if (arg.type === commandType) option.type = oceanicType;
                });
                const isSubcommand = arg.type === ArgumentType.SUB_COMMAND;
                const isSubCommandGroup = arg.type === ArgumentType.SUB_COMMAND_GROUP;
                const isString = arg.type === ArgumentType.STRING;
                const isNumberOrInteger = arg.type === ArgumentType.NUMBER || arg.type === ArgumentType.INTEGER;
                if (isSubcommand || isSubCommandGroup) option.options = [];
                if (!isSubcommand && !isSubCommandGroup) {
                    option.required = !arg.optional;
                }
                if (isString) {
                    if (arg.choices) option.choices = arg.choices;
                    if (arg.minLength) option.minLength = arg.minLength;
                    if (arg.maxLength) option.maxLength = arg.maxLength;
                }
                if (isString || isNumberOrInteger) {
                    option.autocomplete = !!arg.autocomplete;
                }
                if (isNumberOrInteger) {
                    if (arg.minValue) option.minValue = arg.minValue;
                    if (arg.maxValue) option.maxValue = arg.maxValue;
                }
                if (arg.type === ArgumentType.CHANNEL) {
                    if (arg.channelTypes) option.channelTypes = arg.channelTypes;
                }
                // todo: support attachment uploads
            }

            const parseArgument = (arg: any, parent: any) => {
                let argumentData = {};
                apply(arg, argumentData);
                if (arg.arguments && (arg.type === ArgumentType.SUB_COMMAND || arg.type === ArgumentType.SUB_COMMAND_GROUP)) {
                    for (const _argument of arg.arguments) {
                        parseArgument(_argument, argumentData);
                    }
                }
                if (parent.options) parent.options.push(argumentData);
            }
            for (const _argument of command.arguments) {
                parseArgument(_argument, options);
            }
        }
        // if (command.arguments && command.getType() == ApplicationCommandTypes.CHAT_INPUT) {
        //     // This will
        //     (options as CreateChatInputApplicationCommandOptions).options = [];
        // }
        return options;
    }
    /**
     * Creates a hash of the command. Useful for 
     * @param command The command object to create a hash for
     * @returns 
     */
    public static createHash(command: Command): string {
        const hash = crypto.createHash('md5');
        return hash.update([
            command.slashName || command.name,
            (command.slashArguments || '-').toString(),
            (command.prefixArguments || '-').toString(),
            command.description,
            command.permissions?.authorGuild || '-',
            command.nameLocalizations || '-',
            command.descriptionLocalizations || '-'
        ].toString()).digest('hex');
    }
}

// todo: CommmandContext.data (user-defined)

// export default class Command implements CommandDefinition {
    // public readonly name: string;
    // public readonly shashName?: string;
    // constructor()
// }