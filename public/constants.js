export const callType = {
    CHAT_PERSONAL_CODE: "CHAT_PERSONAL_CODE",
    CHAT_STRANGER: "CHAT_STRANGER",
    VIDEO_PERSONAL_CODE: "VIDEO_PERSONAL_CODE",
    VIDEO_STRANGER: "VIDEO_STRANGER",
};

export const preOfferAnswer = {
    CALLEE_NOT_FOUND: "CALLEE_NOT_FOUND",
    CALL_ACCEPTED: "CALL_ACCEPTED",
    CALL_REJECTED: "CALL_REJECTED",
    CALL_UNAVAILABLE: "CALL_UNAVAILABLE",
    CALL_NOT_ANSWERED: "CALL_NOT_ANSWERED"
};

export const webRTCSignaling = {
    OFFER: "OFFER",
    ANSWER: "ANSWER",
    ICE_CANDIDATE: "ICE_CANDIDATE",
};

export const callState = {
    CALL_AVAILABLE: "CALL_AVAILABLE",
    CALL_UNAVAILABLE: "CALL_UNAVAILABLE",
    CALL_AVAILABLE_ONLY_CHAT: "CALL_AVAILABLE_ONLY_CHAT",
};


let myPeerConnectionMetered = {
    iceServers:
        [
             { urls: "stun:stun.relay.metered.ca:80", },
           // { urls: "turn:ekyc2turndev.d1g1talpanin.com:3478?transport=tcp", username: "admin1", credential: "888888", },
             { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: "ac93305a1ce22d2b221ba4d7", credential: "MZ4xTXHHSDwS4roA", },
             { urls: "turn:global.relay.metered.ca:443", username: "ac93305a1ce22d2b221ba4d7", credential: "MZ4xTXHHSDwS4roA", },
             { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "ac93305a1ce22d2b221ba4d7", credential: "MZ4xTXHHSDwS4roA", }
        ],
};

let myPeerConnectionMetered2 = {
    iceServers: [
        {
            urls: "stun:stun.relay.metered.ca:443",
        },
        {
            urls: "turn:global.relay.metered.ca:80",
            username: "84778759785a5fa5316d6641",
            credential: "7ohbx8OAGaAJxS9b",
        },
        {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: "84778759785a5fa5316d6641",
            credential: "7ohbx8OAGaAJxS9b",
        },
        {
            urls: "turn:global.relay.metered.ca:443",
            username: "84778759785a5fa5316d6641",
            credential: "7ohbx8OAGaAJxS9b",
        },
        {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: "84778759785a5fa5316d6641",
            credential: "7ohbx8OAGaAJxS9b",
        },
    ]
};

export const getTurnCred = () => {
    return myPeerConnectionMetered;
}

export const getTurnCred2 = () => {
    return myPeerConnectionMetered2;
}