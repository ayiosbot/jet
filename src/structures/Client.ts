/** @module Client */ 
import { Client as OceanicClient } from 'oceanic.js';
import { ClientOptions } from '../types/client';

export default class Client extends OceanicClient {
    constructor(options?: ClientOptions) {
        super(options);
    }
}