/** @module Types/Client */
import type { ClientOptions as OceanicClientOptions } from 'oceanic.js';
export * from 'oceanic.js/dist/lib/types/client';

export interface ClientOptions extends OceanicClientOptions {
    /** Command prefix. Default `;` */
    prefix?: string;
    /** Register what command types will be used */
    command_types?: {
        /** Default true */
        prefix?: boolean;
        /** Default true */
        interaction?: boolean;
    },
    /** Exact value of __dirname */
    root: string;
}