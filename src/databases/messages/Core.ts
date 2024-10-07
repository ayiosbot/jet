export default {
    DISPATCHER: {
        /** Occurs when trying to process a command. Different from execution. */
        PROCESS_ERROR: `An error occurred while trying to process this command.`,
        EXECUTION_ERROR: `An error occurred while trying to execute the command.`
    },
    MODULE: {
        /** Module disabled by developers */
        DISABLED_BY_DEVELOPERS: `This module is disabled by the bot developer.`,
        /** Module disabled by guild */
        DISABLED_BY_GUILD: `This module is disabled.`,
        DISABLE_GUARDED: `You can't disable this module.`,
        /** Module.preliminaryExecution failed */
        PRELIM_FAIL: `You don't have the permissions to run this command.`,
        /** You need the {missingPermissions} permission to run this command. */
        INSUFFICIENT_PERMISSIONS: `You need the \`{missingPermissions}\` permission to run this command.`
    },
    COMMAND: {
        COOLDOWN: `You're on cooldown! You can run this command {remainingTime}.`,
        PRELIM_FAIL: `You don't have the permissions to run this command.`,
        DISABLED_BY_DEVELOPERS: `This command is disabled by the bot developer.`,
        DISABLED_BY_GUILD: `This command is disabled.`,
        RUN_IN_BLOCKED_CHANNEL: `This command can't be run in this channel!`,
        RUN_WITH_BLOCKED_ROLE: `This command can't be run. This command is disabled for one of your roles.`,
        /** You need the {missingPermissions} permission to run this command. */
        INSUFFICIENT_PERMISSIONS: `You need the \`{missingPermissions}\` permission to run this command.`,
        GENERIC_PERMISSION_ERROR: `You don't have the permissions to run this command.`
    },
}