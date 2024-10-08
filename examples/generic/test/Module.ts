// thing
import { Client, Module } from '@ayios/jet'


export = class TestModule extends Module {
    constructor(client: Client) {
        super('test', client, __filename);

    }
    onLoad(): Promise<void> {
        console.log("I'm so happy!");
        return Promise.resolve();
    }
}