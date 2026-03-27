export const mapApiErrorToKey = (backendMessage: string): string | null => {
    if (!backendMessage) return null;
    
    const msg = backendMessage.toLowerCase();
    if (msg.includes('illegal user') || msg.includes('password') || msg.includes('not exist')) {
        return 'errors.invalidCredentials';
    }
    if (msg.includes('invalid signature') || msg.includes('signature error')) {
        return 'errors.invalidSignature';
    }
    if (msg.includes('token') || msg.includes('expired')) {
        return 'errors.tokenExpired';
    }
    
    return null; // returning null means no mapping is found
};
