package com.classbridge.exception;

public class EmailDeliveryUnavailableException extends RuntimeException {
    public EmailDeliveryUnavailableException() {
        super("Email recovery is temporarily unavailable.");
    }
}
