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
 * Handles errors in a standardized way across the application
 * @param error The error to handle
 * @param context Optional context information about where the error occurred
 * @param showToUser Whether to show the error to the user
 */
export function handleError(error: unknown, context: string = '', showToUser: boolean = true): AppError {
    console.error(`Error ${context ? 'in ' + context : ''}:`, error);

    // Extract error message
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Determine error type and create appropriate message
    let type = ErrorType.UNKNOWN;
    let message = `Error: ${errorMessage}`;

    // Handle network errors
    if (error instanceof TypeError && errorMessage.includes('network')) {
        type = ErrorType.NETWORK;
        message = 'Network error: Please check your internet connection';
    }
    // Handle HTTP status errors
    else if (typeof error === 'object' && error !== null && 'status' in error) {
        const status = (error as { status: number }).status;

        if (status === 429) {
            type = ErrorType.RATE_LIMIT;
            message = 'Rate limit exceeded: Please try again later';
        } else if (status >= 500) {
            type = ErrorType.SERVER;
            message = 'Server error: Please try again later';
        } else if (status === 404) {
            type = ErrorType.NOT_FOUND;
            message = 'Resource not found';
        } else if (status === 401 || status === 403) {
            type = ErrorType.API_KEY;
            message = 'Authentication error: Please check your API key';
        }
    }

    // Create the standardized error object
    const appError: AppError = { type, message, originalError: error };

    // Show error to user if requested
    if (showToUser) {
        vscode.window.showErrorMessage(message);
    }

    return appError;
}
