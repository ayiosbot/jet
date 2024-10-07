import { Message, AnyTextableChannel, Uncached } from 'oceanic.js';
import Client, { ClientEvents, KeyofClientEvents } from './Client';
// todo: disable events with mod@commandExecute (for example)

export default class Event<T extends KeyofClientEvents> {
    public readonly once: boolean = false;
    public readonly type!: T;
    /** Event ID */
    public readonly id!: string;
    public readonly symbol = Symbol();
    public readonly client: Client;
    public readonly module!: string;
    public listener!: ((...args: ClientEvents[T]) => void) | undefined;
    constructor(client: Client) {
        this.client = client;
    }
    createListener(): ((...args: ClientEvents[T]) => void) | undefined {
        this.listener = (...args: ClientEvents[T]) => {
            throw new Error(`Event function for (${this.module}@${this.id}/${this.constructor.name}; ${this.type}) is required`);
        }
        return this.listener;
    }
}