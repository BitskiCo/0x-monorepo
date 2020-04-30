import { RevertError } from '../../revert_error';
import { Numberish } from '../../types';

// tslint:disable:max-classes-per-file
export class PuppetExecuteFailedError extends RevertError {
    constructor(puppet?: string, callTarget?: string, callData?: string, callValue?: Numberish, errorData?: string) {
        super(
            'PuppetExecuteFailedError',
            'PuppetExecuteFailedError(address puppet, address callTarget, bytes callData, uint256 callValue, bytes errorData)',
            {
                puppet,
                callTarget,
                callData,
                callValue,
                errorData,
            },
        );
    }
}

export class InvalidPuppetInstanceError extends RevertError {
    constructor(puppet?: string) {
        super('InvalidPuppetInstanceError', 'InvalidPuppetInstanceError(address puppet)', {
            puppet,
        });
    }
}

export class PuppetNotAcquiredError extends RevertError {
    constructor(puppet?: string) {
        super('PuppetNotAcquiredError', 'PuppetNotAcquiredError(address puppet)', {
            puppet,
        });
    }
}

const types = [InvalidPuppetInstanceError, PuppetExecuteFailedError, PuppetNotAcquiredError];

// Register the types we've defined.
for (const type of types) {
    RevertError.registerType(type);
}
