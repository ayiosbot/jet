import { Collection } from '@ayios/collection';
import { Command } from './Command';
import { join } from 'path';
import Client from './Client';

export default class Module {
    public readonly client: Client;
    public readonly id: string;
    /** Name should be defined by the developer */
    public readonly name!: string;
    /** Indexed by command name */
    public readonly commands = new Collection<string, Command>();
    /** ['w' from 'whois']: WhoisCommand (example) */
    public readonly aliases = new Collection<string, Command>();
    public readonly events = new Collection<string, any>();
    public readonly guarded: boolean = false;
    /** Module file system path */
    public readonly fsPath: string;
    public readonly version: string = '0.0.0';
    get rootDirectory() {
        // return join(this)
        return 'crap';
    }
    constructor(id: string, client: Client, fsPath: string) {
        this.id = id;
        this.client = client;
        this.fsPath = fsPath;
    }
}