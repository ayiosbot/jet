import { Client, CommandDeployment } from '@ayios/jet';
import dotenv from 'dotenv';
import {Intents} from 'oceanic.js';

dotenv.config();

const client = new Client({
    auth: `Bot ${process.env.BOT_TOKEN}`,
    root: __dirname,
    db: null,
    gateway: {
        intents: Intents.MESSAGE_CONTENT + Intents.GUILD_MESSAGES + Intents.GUILDS
    }
});

client.dispatcher.isEnabled = true;
client.registry.registerModule('test')

client.connect();
client.on('ready', () => {
    client.registry.deploySlashCommands(CommandDeployment.Global).then(() => {
        console.log('ready');
    });
});
client.on('messageCreate', m => {
    console.log(m.content);
})