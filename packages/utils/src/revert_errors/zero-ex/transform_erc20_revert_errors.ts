import { RevertError } from '../../revert_error';
import { Numberish } from '../../types';

// tslint:disable:max-classes-per-file
export class InsufficientEthAttachedError extends RevertError {
    constructor(ethAttached?: Numberish, ethNeeded?: Numberish) {
        super('InsufficientEthAttachedError', 'InsufficientEthAttachedError(uint256 ethAttached, uint256 ethNeeded)', {
            ethAttached,
            ethNeeded,
        });
    }
}

export class IncompleteERC20TransformError extends RevertError {
    constructor(outputToken?: string, outputTokenAmount?: Numberish, minOutputTokenAmount?: Numberish) {
        super(
            'IncompleteERC20TransformError',
            'IncompleteERC20TransformError(address outputToken, uint256 outputTokenAmount, uint256 minOutputTokenAmount)',
            {
                outputToken,
                outputTokenAmount,
                minOutputTokenAmount,
            },
        );
    }
}

export class TransferERC20FailedError extends RevertError {
    constructor(token?: string, to?: string, amount?: Numberish) {
        super('TransferERC20FailedError', 'TransferERC20FailedError(address token, address to, uint256 amount)', {
            token,
            to,
            amount,
        });
    }
}

export class ERC20TransformerFailedError extends RevertError {
    constructor(transformer?: string, tokens?: string[], amounts?: Numberish[]) {
        super(
            'ERC20TransformerFailedError',
            'ERC20TransformerFailedError(address transformer, address[] tokens, uint256[] amounts)',
            {
                transformer,
                tokens,
                amounts,
            },
        );
    }
}

export class InvalidTransformationError extends RevertError {
    constructor(transformer?: string, tokens?: string[], amounts?: Numberish[], data?: string) {
        super(
            'InvalidTransformationError',
            'InvalidTransformationError(address transformer, address[] tokens, uint256[] amounts, bytes data)',
            {
                transformer,
                tokens,
                amounts,
                data,
            },
        );
    }
}

export class IncompleteFillSellQuoteError extends RevertError {
    constructor(sellToken?: string, soldAmount?: Numberish, sellAmount?: Numberish) {
        super(
            'IncompleteFillSellQuoteError',
            'IncompleteFillSellQuoteError(address sellToken, address[] soldAmount, uint256[] sellAmount)',
            {
                sellToken,
                soldAmount,
                sellAmount,
            },
        );
    }
}

export class IncompleteFillBuyQuoteError extends RevertError {
    constructor(buyToken?: string, boughtAmount?: Numberish, buyAmount?: Numberish) {
        super(
            'IncompleteFillBuyQuoteError',
            'IncompleteFillBuyQuoteError(address buyToken, address[] boughtAmount, uint256[] buyAmount)',
            {
                buyToken,
                boughtAmount,
                buyAmount,
            },
        );
    }
}

export class InsufficientTakerTokenError extends RevertError {
    constructor(tokenBalance?: Numberish, tokensNeeded?: Numberish) {
        super(
            'InsufficientTakerTokenError',
            'InsufficientTakerTokenError(uint256 tokenBalance, uint256 tokensNeeded)',
            {
                tokenBalance,
                tokensNeeded,
            },
        );
    }
}

export class InsufficientProtocolFeeError extends RevertError {
    constructor(ethBalance?: Numberish, ethNeeded?: Numberish) {
        super('InsufficientProtocolFeeError', 'InsufficientProtocolFeeError(uint256 ethBalance, uint256 ethNeeded)', {
            ethBalance,
            ethNeeded,
        });
    }
}

export class InvalidERC20AssetDataError extends RevertError {
    constructor(assetData?: string) {
        super('InvalidERC20AssetDataError', 'InvalidERC20AssetDataError(bytes assetData)', {
            assetData,
        });
    }
}

export class WrongNumberOfTokensReceivedError extends RevertError {
    constructor(actual?: Numberish, expected?: Numberish) {
        super(
            'WrongNumberOfTokensReceivedError',
            'WrongNumberOfTokensReceivedError(uint256 actual, uint256 expected)',
            {
                actual,
                expected,
            },
        );
    }
}

export class InvalidTokenReceivedError extends RevertError {
    constructor(token?: string) {
        super('InvalidTokenReceivedError', 'InvalidTokenReceivedError(address token)', {
            token,
        });
    }
}

const types = [
    InsufficientEthAttachedError,
    IncompleteERC20TransformError,
    TransferERC20FailedError,
    ERC20TransformerFailedError,
    InvalidTransformationError,
    IncompleteFillSellQuoteError,
    IncompleteFillBuyQuoteError,
    InsufficientTakerTokenError,
    InsufficientProtocolFeeError,
    InvalidERC20AssetDataError,
    WrongNumberOfTokensReceivedError,
    InvalidTokenReceivedError,
];

// Register the types we've defined.
for (const type of types) {
    RevertError.registerType(type);
}
