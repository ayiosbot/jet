/** @module Types/Webhooks */

export interface CreateWebhookOptions {
    /** The avatar (buffer, or full data url). */
    avatar?: Buffer | string | null;
    /** The name of the webhook. */
    name: string;
    /** The reason for creating this webhook. */
    reason?: string;
}

export interface EditWebhookTokenOptions  {
    /** The new avatar (buffer, or full data url). `null` to reset. */
    avatar?: Buffer | string | null;
    /** The name of the webhook. */
    name?: string;
}
export interface EditWebhookOptions extends EditWebhookTokenOptions {
    /** The id of the channel to move this webhook to. */
    channelID?: string;
    /** The reason for editing this webhook. */
    reason?: string;
}

export interface GetWebhookMessageOptions {
    messageID: string;
    threadID?: string;
}

export interface DeleteWebhookMessageOptions {
    /** The id of the thread the message is in. */
    threadID?: string;
}
