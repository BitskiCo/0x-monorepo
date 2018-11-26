import * as ethUtil from 'ethereumjs-util';
import * as _ from 'lodash';

import * as Constants from '../utils/constants';
import { EncodingRules } from '../utils/rules';

import * as CalldataBlocks from './blocks';
import { CalldataBlock } from './calldata_block';
import { CalldataIterator, ReverseCalldataIterator } from './iterator';

export class Calldata {
    private readonly _rules: EncodingRules;
    private _selector: string;
    private _sizeInBytes: number;
    private _root: CalldataBlock | undefined;

    public constructor(rules: EncodingRules) {
        this._rules = rules;
        this._selector = '';
        this._sizeInBytes = 0;
        this._root = undefined;
    }

    public optimize(): void {
        if (this._root === undefined) {
            throw new Error('expected root');
        }

        const blocksByHash: { [key: string]: CalldataBlock } = {};

        // 1. Create a queue of subtrees by hash
        // Note that they are ordered the same as
        const iterator = new ReverseCalldataIterator(this._root);
        for (const block of iterator) {
            if (block instanceof CalldataBlocks.Pointer) {
                const dependencyBlockHashBuf = block.getDependency().computeHash();
                const dependencyBlockHash = ethUtil.bufferToHex(dependencyBlockHashBuf);
                if (dependencyBlockHash in blocksByHash) {
                    const blockWithSameHash = blocksByHash[dependencyBlockHash];
                    if (blockWithSameHash !== block.getDependency()) {
                        block.setAlias(blockWithSameHash);
                    }
                }
                continue;
            }

            const blockHashBuf = block.computeHash();
            const blockHash = ethUtil.bufferToHex(blockHashBuf);
            if (!(blockHash in blocksByHash)) {
                blocksByHash[blockHash] = block;
            }
        }
    }

    public toHexString(): string {
        if (this._root === undefined) {
            throw new Error('expected root');
        }

        if (this._rules.optimize) {
            this.optimize();
        }

        const iterator = new CalldataIterator(this._root);
        let offset = 0;
        for (const block of iterator) {
            block.setOffset(offset);
            offset += block.getSizeInBytes();
        }

        const hexValue = this._rules.annotate ? this._generateAnnotatedHexString() : this._generateCondensedHexString();
        return hexValue;
    }

    public getSelectorHex(): string {
        return this._selector;
    }

    public getSizeInBytes(): number {
        return this._sizeInBytes;
    }

    public setRoot(block: CalldataBlock): void {
        this._root = block;
        this._sizeInBytes += block.getSizeInBytes();
    }

    public setSelector(selector: string): void {
        this._selector = selector.startsWith('0x') ? selector : `$0x${selector}`;
        if (this._selector.length !== Constants.HEX_SELECTOR_LENGTH_IN_CHARS) {
            throw new Error(`Invalid selector '${this._selector}'`);
        }
        this._sizeInBytes += Constants.HEX_SELECTOR_LENGTH_IN_BYTES; // @TODO: Used to be += 8. Bad?
    }

    private _generateAnnotatedHexString(): string {
        let hexValue = `${this._selector}`;
        if (this._root === undefined) {
            throw new Error('expected root');
        }

        const iterator = new CalldataIterator(this._root);
        let offset = 0;
        const functionName: string = this._root.getName();
        for (const block of iterator) {
            // Process each block 1 word at a time
            const size = block.getSizeInBytes();
            const name = block.getName();
            const parentName = block.getParentName();
            const prettyName = name.replace(`${parentName}.`, '').replace(`${functionName}.`, '');

            // Current offset
            let offsetStr = '';

            // If this block is empty then it's a newline
            const offsetPadding = 10;
            const valuePadding = 74;
            const namePadding = 80;
            const evmWordStartIndex = 0;
            const emptySize = 0;
            let value = '';
            let nameStr = '';
            let line = '';
            if (size === emptySize) {
                offsetStr = ' '.repeat(offsetPadding);
                value = ' '.repeat(valuePadding);
                nameStr = `### ${prettyName.padEnd(namePadding)}`;
                line = `\n${offsetStr}${value}${nameStr}`;
            } else {
                offsetStr = `0x${offset.toString(Constants.HEX_BASE)}`.padEnd(offsetPadding);
                value = ethUtil
                    .stripHexPrefix(
                        ethUtil.bufferToHex(
                            block.toBuffer().slice(evmWordStartIndex, Constants.EVM_WORD_WIDTH_IN_BYTES),
                        ),
                    )
                    .padEnd(valuePadding);
                if (block instanceof CalldataBlocks.Set) {
                    nameStr = `### ${prettyName.padEnd(namePadding)}`;
                    line = `\n${offsetStr}${value}${nameStr}`;
                } else {
                    nameStr = `    ${prettyName.padEnd(namePadding)}`;
                    line = `${offsetStr}${value}${nameStr}`;
                }
            }

            for (let j = Constants.EVM_WORD_WIDTH_IN_BYTES; j < size; j += Constants.EVM_WORD_WIDTH_IN_BYTES) {
                offsetStr = `0x${(offset + j).toString(Constants.HEX_BASE)}`.padEnd(offsetPadding);
                value = ethUtil
                    .stripHexPrefix(
                        ethUtil.bufferToHex(block.toBuffer().slice(j, j + Constants.EVM_WORD_WIDTH_IN_BYTES)),
                    )
                    .padEnd(valuePadding);
                nameStr = ' '.repeat(namePadding);
                line = `${line}\n${offsetStr}${value}${nameStr}`;
            }

            // Append to hex value
            hexValue = `${hexValue}\n${line}`;
            offset += size;
        }

        return hexValue;
    }

    private _generateCondensedHexString(): string {
        const selectorBuffer = ethUtil.toBuffer(this._selector);
        if (this._root === undefined) {
            throw new Error('expected root');
        }

        const iterator = new CalldataIterator(this._root);
        const valueBufs: Buffer[] = [selectorBuffer];
        for (const block of iterator) {
            valueBufs.push(block.toBuffer());
        }

        const combinedBuffers = Buffer.concat(valueBufs);
        const hexValue = ethUtil.bufferToHex(combinedBuffers);
        return hexValue;
    }
}
