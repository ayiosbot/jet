// so this
import { Client, Command, ArgumentType, CommandContext, CommandResult } from '@ayios/jet';

export = class PingCommand extends Command {
    constructor(client: Client) {
        super(client, {
            name: 'ping',
            description: 'Ping the bot',
            module: 'test',
            arguments: [
                {
                    name: 'user',
                    description: 'who',
                    type: ArgumentType.USER
                }
            ]
        }, __filename);
    }
    run(context: CommandContext): Promise<CommandResult> {
        console.log(context.arguments.getUser('user'))
        context.reply(`Hello ${context.arguments.getUser('user')?.globalName}`)
            .catch(() => false);
        return Promise.resolve(CommandResult.Success);
    }
}