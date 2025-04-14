import * as vscode from 'vscode';

/**
 * Standardized error types for the application
 */
export enum ErrorType {
    NETWORK = 'NETWORK',
    API_KEY = 'API_KEY',
    RATE_LIMIT = 'RATE_LIMIT',
    SERVER = 'SERVER',
    NOT_FOUND = 'NOT_FOUND',
    VALIDATION = 'VALIDATION',
    UNKNOWN = 'UNKNOWN'
}

/**
 * Standardized error interface
 */
export interface AppError {
    type: ErrorType;
    message: string;
    originalError?: unknown;
}

/**
 * Creates a standardized error object
 */
export function createError(type: ErrorType, message: string, originalError?: unknown): AppError {
    return { type, message, originalError };
}

/**
 * Handles errors in a standardized way across the application
 * @param error The error to handle
 * @param context Optional context information about where the error occurred
 * @param showToUser Whether to show the error to the user
 */
export function handleError(error: unknown, context: string = '', showToUser: boolean = true): AppError {
    console.error(`Error ${context ? 'in ' + context : ''}:`, error);

    let appError: AppError;

    // Determine the type of error
    if (error instanceof TypeError && error.message.includes('network')) {
        appError = createError(
            ErrorType.NETWORK,
            'Network error: Please check your internet connection',
            error
        );
    } else if (typeof error === 'object' && error !== null && 'status' in error) {
        const statusError = error as { status: number };
        if (statusError.status === 429) {
            appError = createError(
                ErrorType.RATE_LIMIT,
                'Rate limit exceeded: Please try again later',
                error
            );
        } else if (statusError.status >= 500) {
            appError = createError(
                ErrorType.SERVER,
                'Server error: Please try again later',
                error
            );
        } else if (statusError.status === 404) {
            appError = createError(
                ErrorType.NOT_FOUND,
                'Resource not found',
                error
            );
        } else if (statusError.status === 401 || statusError.status === 403) {
            appError = createError(
                ErrorType.API_KEY,
                'Authentication error: Please check your API key',
                error
            );
        } else {
            appError = createError(
                ErrorType.UNKNOWN,
                `Error: ${error instanceof Error ? error.message : String(error)}`,
                error
            );
        }
    } else {
        appError = createError(
            ErrorType.UNKNOWN,
            `Error: ${error instanceof Error ? error.message : String(error)}`,
            error
        );
    }

    // Show error to user if requested
    if (showToUser) {
        vscode.window.showErrorMessage(appError.message);
    }

    return appError;
}
