
import { Client, Event } from '@ayios/jet';

export = class MessageCreateEvent extends Event<'messageCreate'> {
    public readonly id = 'GuildLogger';
    public readonly type = 'messageCreate';
    constructor(client: Client) {
        super(client);
    }
    createListener()  {
        this.listener = (message) => {
            console.log(`Message from ${message.author.id} in ${message.channelID}!`);
        }
        console.log('CREATEDDDDDD')
        return this.listener;
    }
}