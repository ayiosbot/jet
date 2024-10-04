import type Client from './Client';
import { Command } from './Command';
import Dispatcher from './Dispatcher';

export type IGroupRegister = [ id: string, name: string ];

type yo = (c: Command) => Promise<boolean>;
export default class Registry {
    constructor(client: Client, dispatcher: Dispatcher) {
        if (client.application) {
            console.log('app')
            console.log(client.startTime);
            client.disconnect()
        }
        if (dispatcher) {
            console.log('ap2')
            const c = new Dispatcher(client);
            if (c.has())  {

            }
        }
    }
    registerGroups(groups: IGroupRegister[]): this {
        return this;
    }
    registerCommands(validator: (command: Command) => Promise<boolean>) {
        // go through commands
        // validator(command).then(register).catch(() => {})
    }
}