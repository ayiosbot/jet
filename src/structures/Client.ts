/** @module Client */ 
import {
    AnyTextableChannel, CommandInteraction, CreateMessageOptions, ExecuteWebhookOptions,
    Message, Client as OceanicClient, Uncached, ClientOptions as OceanicClientOptions,
    ClientEvents as OceanicClientEvents,
    GuildChannel,
    Webhook,
    AnyTextableGuildChannel
} from 'oceanic.js';
import Module from './Module';
import { Command, CommandContext } from './Command';
import Registry from './Registry';
import Event from './Event';
import Dispatcher from './Dispatcher';


export interface ClientOptions<DB = undefined> extends OceanicClientOptions {
    /** Command prefix. Default `;` */
    prefix?: string;
    /**
     * Register what command types will be used. If false, hooks will NOT be made.
     */
    command_types?: {
        /** Default true */
        prefix?: boolean;
        /** Default true */
        interaction?: boolean;
    },
    /** Exact value of __dirname */
    root: string;
    /**
     * Mandatory field. Just an easy client-wide client storage method, typically for databases.
     * 
     * Set to null if unused.
     */
    db: DB;
}

export type KeyofClientEvents = keyof ClientEvents;
export interface ClientEvents extends OceanicClientEvents {
    eventRegister: [ event: Event<any>,       isReload: boolean ];
    eventLoad:     [ event: Event<any>,       isReload: boolean ];
    eventUnload:   [ event: Event<any>,       isReload: boolean ];
    eventReload:   [ event: Event<any>                          ];
    moduleLoad:    [ module: Module,          isReload: boolean ];
    moduleUnload:  [ module: Module,          isReload: boolean ];
    moduleReload:  [ module: Module                             ];
    commandLoad:   [ command: Command,        isReload: boolean ];
    commandUnload: [ command: Command,        isReload: boolean ];
    commandReload: [ command: Command                           ];
}

export default class Client<DB = any> extends OceanicClient<ClientEvents> {
    public readonly registry: Registry;
    public readonly dispatcher: Dispatcher;
    public readonly db: DB;
    public readonly prefix?: string;
    public readonly root: string;
    constructor(options: ClientOptions<DB>) {
        super(options);
        this.db = options.db;
        if (options.prefix) this.prefix = options.prefix;
        this.root = options.root;

        this.registry = new Registry(this);
        this.dispatcher = new Dispatcher(this);
    }
    public setPrefix(prefix: string): void {
        Object.defineProperty(this, 'prefix', { value: prefix });
    }
    public leaveGuild(guildID: string) {
        return this.rest.users.leaveGuild(guildID);
    }
    public async getChannelWebhooks(channelID: string) {
        return this.rest.webhooks.getForChannel(channelID);
    }
    /** Execute a webhook by URL */
    public executeWebhookURL(url: string, options: ExecuteWebhookOptions) {
        const match = url.match(/https:\/\/discord\.com\/api\/webhooks\/(\d+)\/([\w-]+)/);
        if (!match) throw new Error('Cannot parse webhook URL');

        return this.executeWebhook(match[1], match[2], options);
    }
    /** Execute a webhook by its detailed information */
    public executeWebhook(webhookID: string, token: string, options: ExecuteWebhookOptions) {
        return this.rest.webhooks.execute(webhookID, token, options);
    }
    /** get or create a webhook (uses the bot name for identifying) */
    public async resolveWebhook(channelID: string, filterOverride?: (webhook: Webhook) => boolean) {
        try {
            const webhooks = await this.getChannelWebhooks(channelID);
            let found;
            for (const webhook of webhooks) {
                if (filterOverride) {
                    if (filterOverride(webhook)) {
                        found = webhook;
                        break;
                    }
                } else {
                    if (
                        webhook.name === (this.user.globalName || this.user.username)
                        || webhook.applicationID === this.application.id
                    ) {
                        found = webhook;
                    }
                }
            }
            if (!found) {
                found = await this.rest.webhooks.create(channelID, {
                    name: this.user.globalName || this.user.username,
                    avatar: this.user.avatar
                });
            }
            return Promise.resolve(found);
        } catch (error) {
            return Promise.reject(error);
        }
    }
    public getMessage(channelID: string, messageID: string) {
        return this.rest.channels.getMessage(channelID, messageID);
    }
    public createMessage(channelID: string, options: CreateMessageOptions) {
        return this.rest.channels.createMessage(channelID, options);
    }
    public deleteMessage(channelID: string, messageID: string, reason?: string) {
        return this.rest.channels.deleteMessage(channelID, messageID, reason);
    }
    public reply(message: Message<AnyTextableChannel | Uncached> | CommandInteraction, content: CreateMessageOptions) {
        if (message instanceof Message) {
            return message.channel!.createMessage(content);
        } else {
            return message.reply(content);
        }
    }
    // public override async connect(): Promise<void> {
    //     for (const module of this.registry.modules.values()) {
    //         await Promise.all([ module.loadCommands(), module.loadEvents() ]);

    //         for (const event of module.events.values()) {
    //             if (!event.listener) event.createListener();
    //             if (event.once) {
    //                 this.once(event.type, event.listener!);
    //             } else this.on(event.type, event.listener!);
    //         }
    //     }
    //     return super.connect();
    // }
}
    // /** Command prefix. Default `;` */
    // prefix?: string;
    // /** Register what command types will be used */
    // command_types?: {
    //     /** Default true */
    //     prefix?: boolean;
    //     /** Default true */
    //     interaction?: boolean;
    // },
    // /** Exact value of __dirname */
    // root: string;
    // db: DB;