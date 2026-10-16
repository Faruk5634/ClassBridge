package com.classbridge.exception;

public class InvalidRecoveryCodeException extends RuntimeException {
    public InvalidRecoveryCodeException() {
        super("The code is invalid, expired, or no longer usable.");
    }
}
