import { Permission } from 'oceanic.js';
import Permissions from './databases/Permissions';

export default {
    /** Returns the missing permissions (as a bigint[]) */
    missing(permission: Permission, ...search: bigint[]): bigint[] {
        const missingArray: any[] = [];
        search.forEach(b => {
            if (!permission.has(b)) missingArray.push(b);
        });
        return missingArray;
    },
    /** Returns the missing permissions (as a string[]) */
    missingStrings(permission: Permission, ...search: bigint[]): string[] {
        const array = this.missing(permission, ...search);
        return array.map(m => Permissions[m.toString()]);
    },
}