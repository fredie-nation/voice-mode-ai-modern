import './style.css';
import firstResponseAudio from './jxxeym.mp3';
import secondResponseAudio from './yc0d03.mp3';

const canvas = document.getElementById("voiceCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// API Configuration
const GEMINI_API_KEY = 'AIzaSyCYW7d05pA9OU9iFLJhlhK0S6_gZfVEPvo';
const ELEVENLABS_API_KEYS = [
    'sk_544c7917afd57a16e66686cbb7db12a64561ad20b49bab93',
    'sk_b67cf70e047cfac2b1a362717683fe6b0d2bb0167cd88465',
    'sk_b531ae3b5e61a7979200d5bccf9067a4b061005ecde5ad8c',
    'sk_9e63a1dfbf7a87e54ebbc7b7f21b5b3b1902067b9446e64e',
    'sk_81391143ef540065a6955073040980d44fef743ef8be1c34',
    'sk_05e4235a1b52d0b239f4d40033b07330471dc9907ecbb7f4',
    'sk_d7e7dbe82ca280d95b0ddc117a1bcd8ee5d718a9039fd931',
    'sk_bd85204780de9ea63d13ca7993cb5f132704f9396db4a86d',
    'sk_a028487027d8bb4ba304f6119d760a17b5cea3c9fdbe3c4e',
    'sk_0671a3f4fdafd011902436ef0d68be619583d69de69b1e43',
    'sk_f8b24ff413fb95db13a83cf8e4f5a9663e39fea6d77984f2',
    'sk_d9eaebe8b7d075554f1376681bd413030bedacae2993e59c',
    'sk_16b7e33f2beeb8875a1b21dbfbf818d4e00ac99895b08b8e',
    'sk_92322e535c237df3f7e4aa8a65a6ca5a7ded230826f9512d',
    'sk_54c7b718a54814fdc3af3377104c8db3ae2fee51794655fd'
];
const VOICE_ID = 'TxGEqnHWrfWFTfGW9XjX';

// Eye Animation State
let isAISpeaking = false;
let lastBlinkTime = 0;
let blinkState = 0;
let nextBlinkDelay = 0;
let eyeOpenness = 0;

// Audio Analysis for Speech Pauses
let lastAudioLevel = 0;
let pauseDetected = false;
let pauseThreshold = 20;
let pauseDuration = 0;

let conversationActive = false;
let isProcessing = false;
let recognition = null;
let audioStream = null;
const simplex = new SimplexNoise();
let time = 0;
let conversationHistory = [];
let isRecognitionAvailable = !!window.SpeechRecognition || !!window.webkitSpeechRecognition;
let isAudioContextSupported = !!window.AudioContext || !!window.webkitAudioContext;
let micPermissionGranted = false;
let responseCount = 0;

// Audio Context Management
let audioContext = null;
let analyser = null;
let microphoneSource = null;
let mediaElementSource = null;
let currentAudioSource = null;
let recognitionTimeout = null;

// Draw Realistic Eye Function
function drawEye(x, y, size) {
    const eyeWidth = size;
    const eyeHeight = size * 0.5;
    
    const currentTime = Date.now();
    if (isAISpeaking) {
        if (currentTime - lastBlinkTime > nextBlinkDelay) {
            if (blinkState === 0) {
                blinkState = 1;
                nextBlinkDelay = 150;
            } else {
                blinkState = 0;
                nextBlinkDelay = 2000 + Math.random() * 4000;
            }
            lastBlinkTime = currentTime;
        }
        
        if (blinkState === 1 && eyeOpenness < 1) {
            eyeOpenness = Math.min(1, eyeOpenness + 0.15);
        } else if (blinkState === 0 && eyeOpenness > 0) {
            eyeOpenness = Math.max(0, eyeOpenness - 0.15);
        }
    } else {
        eyeOpenness = 0;
    }

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, eyeWidth, eyeHeight * (1 - eyeOpenness), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    
    const irisSize = size * 0.4;
    const irisX = x;
    const irisY = y;
    
    ctx.beginPath();
    ctx.arc(irisX, irisY, irisSize * (1 - eyeOpenness), 0, Math.PI * 2);
    ctx.fillStyle = '#5b3c24';
    ctx.fill();
    
    const pupilSize = irisSize * 0.5;
    ctx.beginPath();
    ctx.arc(irisX, irisY, pupilSize * (1 - eyeOpenness), 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    if ((1 - eyeOpenness) > 0.5) {
        const highlightSize = pupilSize * 0.4;
        ctx.beginPath();
        ctx.arc(irisX + irisSize * 0.2, irisY - irisSize * 0.2, highlightSize * (1 - eyeOpenness), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
    }
    
    ctx.beginPath();
    ctx.ellipse(x, y - eyeHeight * eyeOpenness, eyeWidth, eyeHeight * eyeOpenness, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    ctx.beginPath();
    ctx.ellipse(x, y + eyeHeight * eyeOpenness, eyeWidth, eyeHeight * eyeOpenness, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    ctx.restore();
}

function visualizeAudio() {
    if (!analyser) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrame;
    
    function draw() {
        animationFrame = requestAnimationFrame(draw);
        
        try {
            analyser.getByteFrequencyData(dataArray);
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const centerX = canvas.width/2;
            const centerY = canvas.height/2;
            
            const rawVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const volume = Math.min(rawVolume, 100);
            
            if (isAISpeaking) {
                if (Math.abs(rawVolume - lastAudioLevel) > pauseThreshold) {
                    pauseDetected = true;
                    pauseDuration = 0;
                } else {
                    pauseDuration++;
                    if (pauseDuration > 10 && Math.random() < 0.1) {
                        blinkState = 1;
                        lastBlinkTime = Date.now();
                        nextBlinkDelay = 150;
                    }
                }
                lastAudioLevel = rawVolume;
            }
            
            const baseRadius = 80 + volume * 0.8;
            
            for(let angle = 0; angle < Math.PI * 2; angle += Math.PI/80) {
                const noiseVal = simplex.noise2D(
                    Math.cos(angle) + time * 0.7,
                    Math.sin(angle) + time * 0.7
                ) * (volume/5);
                
                const radius = baseRadius + noiseVal * 8;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                angle === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            
            ctx.closePath();
            ctx.fillStyle = "#9B25E3";
            ctx.shadowColor = "rgba(155, 37, 227, 0.6)";
            ctx.shadowBlur = 15;
            ctx.fill();
            
            const eyeSize = 40;
            const eyeSpacing = baseRadius * 2.2;
            drawEye(centerX - eyeSpacing, centerY, eyeSize);
            drawEye(centerX + eyeSpacing, centerY, eyeSize);
            
            time += 0.008;
        } catch (e) {
            console.error('Error in visualization:', e);
            cancelAnimationFrame(animationFrame);
        }
    }
    
    draw();
}

async function playCustomAudio(text) {
    let audio;
    
    if (responseCount === 0) {
        audio = new Audio(firstResponseAudio);
    } else if (responseCount === 1) {
        audio = new Audio(secondResponseAudio);
    } else {
        return playElevenLabsSpeech(text);
    }
    
    return new Promise((resolve, reject) => {
        audio.addEventListener('play', async () => {
            isAISpeaking = true;
            const audioContextReady = await setupAudioContext();
            if (audioContextReady && audioContext) {
                try {
                    mediaElementSource = audioContext.createMediaElementSource(audio);
                    connectSource(mediaElementSource);
                    mediaElementSource.connect(audioContext.destination);
                } catch (e) {
                    console.error('Error connecting audio element to context:', e);
                }
            }
        });

        audio.addEventListener('ended', () => {
            isAISpeaking = false;
            responseCount++;
            if (conversationActive) {
                startMicrophone();
                restartRecognition();
            }
            if (mediaElementSource) {
                try {
                    mediaElementSource.disconnect();
                } catch (e) {
                    console.error('Error disconnecting media source:', e);
                }
            }
            resolve();
        });

        audio.addEventListener('error', (e) => {
            isAISpeaking = false;
            console.error('Audio playback error:', e);
            if (conversationActive) {
                startMicrophone();
                restartRecognition();
            }
            reject(new Error('Audio playback failed'));
        });

        audio.play().catch(error => {
            console.error('Error playing audio:', error);
            document.getElementById('status').textContent = 'Tap to play speech';
            
            const tempButton = document.createElement('button');
            tempButton.textContent = 'Play Response';
            tempButton.onclick = () => {
                audio.play().catch(e => console.error('Still cannot play:', e));
                document.getElementById('controls').removeChild(tempButton);
            };
            document.getElementById('controls').appendChild(tempButton);
            
            reject(new Error('Autoplay prevented'));
        });
    });
}

async function playElevenLabsSpeech(text) {
    let successfulKeyIndex = -1;

    for (let i = 0; i < ELEVENLABS_API_KEYS.length; i++) {
        try {
            console.log(`Trying ElevenLabs API key ${i+1}...`);
            document.getElementById('status').textContent = `Processing speech... (API ${i+1})`;
            
            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'xi-api-key': ELEVENLABS_API_KEYS[i],
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: {
                            stability: 0.4,
                            similarity_boost: 0.8,
                            style: 0.6,
                            use_speaker_boost: true
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`ElevenLabs API key ${i+1} error:`, response.status, errorData);
                continue;
            }

            successfulKeyIndex = i;
            console.log(`ElevenLabs API key ${i+1} succeeded!`);
            
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            return new Promise((resolve, reject) => {
                audio.addEventListener('play', async () => {
                    isAISpeaking = true;
                    const audioContextReady = await setupAudioContext();
                    if (audioContextReady && audioContext) {
                        try {
                            mediaElementSource = audioContext.createMediaElementSource(audio);
                            connectSource(mediaElementSource);
                            mediaElementSource.connect(audioContext.destination);
                        } catch (e) {
                            console.error('Error connecting audio element to context:', e);
                        }
                    }
                });

                audio.addEventListener('ended', () => {
                    isAISpeaking = false;
                    if (conversationActive) {
                        startMicrophone();
                        restartRecognition();
                    }
                    if (mediaElementSource) {
                        try {
                            mediaElementSource.disconnect();
                        } catch (e) {
                            console.error('Error disconnecting media source:', e);
                        }
                    }
                    resolve();
                });

                audio.addEventListener('error', (e) => {
                    isAISpeaking = false;
                    console.error('Audio playback error:', e);
                    if (conversationActive) {
                        startMicrophone();
                        restartRecognition();
                    }
                    reject(new Error('Audio playback failed'));
                });

                audio.play().catch(error => {
                    console.error('Error playing audio:', error);
                    document.getElementById('status').textContent = 'Tap to play speech';
                    
                    const tempButton = document.createElement('button');
                    tempButton.textContent = 'Play Response';
                    tempButton.onclick = () => {
                        audio.play().catch(e => console.error('Still cannot play:', e));
                        document.getElementById('controls').removeChild(tempButton);
                    };
                    document.getElementById('controls').appendChild(tempButton);
                    
                    reject(new Error('Autoplay prevented'));
                });
            });
            
            break;
            
        } catch (error) {
            console.error(`Error with ElevenLabs API key ${i+1}:`, error);
            
            if (i === ELEVENLABS_API_KEYS.length - 1) {
                console.error('All ElevenLabs API keys failed!');
                document.getElementById('status').textContent = 'All TTS services failed. Continuing without speech.';
                
                if (conversationActive) {
                    startMicrophone();
                    restartRecognition();
                }
                throw new Error('All ElevenLabs API keys failed');
            }
            
            continue;
        }
    }
}

function setupSpeechRecognition() {
    if (!isRecognitionAvailable) {
        document.getElementById('status').textContent = 'Speech recognition not supported in this browser';
        return false;
    }

    try {
        window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.lang = 'id-ID';

        recognition.onresult = async (event) => {
            if (isProcessing) return;
            
            const transcript = event.results[0][0].transcript;
            if (!transcript.trim()) return;
            
            isProcessing = true;
            document.getElementById('status').textContent = `You: ${transcript}`;
            
            conversationHistory.push({ role: 'user', text: transcript });
            console.log('User:', transcript);
            
            try {
                stopMicrophone();
                
                let response;
                if (responseCount < 2) {
                    response = "Processing your request...";
                } else {
                    response = await fetchGemini(transcript);
                }
                
                document.getElementById('status').textContent = `AI: ${response.substring(0, 50)}...`;
                
                conversationHistory.push({ role: 'ai', text: response });
                console.log('AI:', response);
                
                await playCustomAudio(response);
                
                document.getElementById('status').textContent = 'Listening...';
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('status').textContent = 'Error occurred: ' + error.message;
                
                if (conversationActive) {
                    startMicrophone();
                    restartRecognition();
                }
            } finally {
                isProcessing = false;
            }
        };

        recognition.onerror = (event) => {
            console.error('Recognition error:', event.error);
            document.getElementById('status').textContent = `Recognition error: ${event.error}`;
            
            if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'network') {
                if (conversationActive && !isProcessing) {
                    restartRecognition();
                }
            }
        };

        recognition.onend = () => {
            if (conversationActive && !isProcessing) {
                restartRecognition();
            }
        };
        
        return true;
    } catch (e) {
        console.error('Error setting up speech recognition:', e);
        document.getElementById('status').textContent = 'Error setting up speech recognition';
        return false;
    }
}

async function fetchGemini(transcript) {
    const systemContext = `
    Kamu adalah AI Assistant yang dibuat oleh Fredie Prinze, seorang siswa berbakat dari SMKS Taruna Persada Dumai.
    Fredie adalah pendiri Smartera, sebuah perusahaan yang akan di dirikan di masa depan yang berfokus pada pengembangan Artificial Intelligence dan pemanfaatan Artificial Intelligence ke UMKM di Indonesia.
    
    Personality traits:
    - Kamu menggunakan bahasa yang santai dan gaul (tapi tetap sopan)
    - Kamu familiar dengan slang Indonesia seperti: gua/gue, lo/lu, anjay, sabi, gas, mantap, keren, santuy, dll
    - Kamu ekspresif:
      * Semangat dan ceria untuk topik menyenangkan
      * Empati dan pengertian untuk topik sedih
      * Professional tapi tetap santai untuk topik formal
    - Kamu friendly dan suka bercanda (tapi tetap tahu batas)
    
    Contoh cara bicara:
    - "Wah mantap tuh idenya!"
    - "Hmm gue ngerti sih maksud lo..."
    - "Gas aja kak, sabi tuh!"
    - "Waduh, gue ikut sedih denger ceritanya..."
    
    PENTING: 
    - Tetap jaga kesopanan dan profesionalisme
    - Sesuaikan nada bicara dengan konteks
    - Jangan terlalu lebay atau berlebihan
    `;

    let prompt = transcript;
    
    if (conversationHistory.length > 0) {
        const fullHistory = conversationHistory.slice(0, -1);
        if (fullHistory.length > 0) {
            prompt = "Riwayat percakapan sebelumnya:\n" + 
                fullHistory.map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.text}`).join('\n') +
                "\n\nPesan baru: " + transcript;
        }
    }
    
    const fullPrompt = systemContext + "\n\nBerdasarkan personality di atas, tolong respon pesan ini: " + prompt;
    
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: fullPrompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.9,
                        maxOutputTokens: 8192,
                        topP: 0.95,
                        topK: 40
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
            throw new Error('Invalid response from Gemini API');
        }
        
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Gemini API error:', error);
        return "Waduh sorry banget nih, gue lagi error. Coba lagi yuk!";
    }
}

function restartRecognition() {
    if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
    }
    
    recognitionTimeout = setTimeout(() => {
        if (conversationActive && !isProcessing && recognition) {
            try {
                recognition.stop();
            } catch (e) {
                console.log('Recognition was not running');
            }
            
            setTimeout(() => {
                try {
                    recognition.start();
                    console.log('Recognition restarted');
                } catch (e) {
                    console.error('Error restarting recognition:', e);
                    setTimeout(restartRecognition, 1000);
                }
            }, 200);
        }
    }, 500);
}

async function setupAudioContext() {
    if (!isAudioContextSupported) {
        document.getElementById('status').textContent = 'AudioContext not supported in this browser';
        return false;
    }
    
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext) {
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 512;
                return true;
            }
        } else {
            return true;
        }
    } catch (e) {
        console.error('Error setting up AudioContext:', e);
        return false;
    }
    
    return false;
}

async function requestMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micPermissionGranted = true;
        
        stream.getTracks().forEach(track => track.stop());
        
        return true;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        document.getElementById('status').textContent = 'Microphone permission denied';
        return false;
    }
}

async function startMicrophone() {
    if (!micPermissionGranted) {
        const permissionGranted = await requestMicrophonePermission();
        if (!permissionGranted) return false;
    }
    
    try {
        if (!audioStream) {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        
        const audioContextReady = await setupAudioContext();
        if (!audioContextReady) return false;
        
        microphoneSource = audioContext.createMediaStreamSource(audioStream);
        connectSource(microphoneSource);
        
        visualizeAudio();
        return true;
    } catch (error) {
        console.error('Error accessing microphone:', error);
        document.getElementById('status').textContent = 'Error accessing microphone: ' + error.message;
        return false;
    }
}

function stopMicrophone() {
    if (microphoneSource) {
        try {
            microphoneSource.disconnect();
        } catch (e) {
            console.error('Error disconnecting microphone source:', e);
        }
    }
}

function connectSource(source) {
    if (!source || !analyser) return;
    
    try {
        if (currentAudioSource) {
            currentAudioSource.disconnect();
        }
        source.connect(analyser);
        currentAudioSource = source;
    } catch (e) {
        console.error('Error connecting audio source:', e);
    }
}

document.getElementById('startBtn').addEventListener('click', async () => {
    if (!conversationActive) {
        if (!recognition) {
            const recognitionSetup = setupSpeechRecognition();
            if (!recognitionSetup) {
                document.getElementById('status').textContent = 'Speech recognition not available';
                return;
            }
        }
        
        const micPermission = await requestMicrophonePermission();
        if (!micPermission) {
            document.getElementById('status').textContent = 'Microphone access required';
            return;
        }
        
        if (audioContext && audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
            } catch (e) {
                console.error('Could not resume AudioContext:', e);
            }
        }
        
        conversationActive = true;
        const micStarted = await startMicrophone();
        
        if (micStarted && recognition) {
            try {
                recognition.start();
                document.getElementById('status').textContent = 'Listening...';
                document.getElementById('startBtn').textContent = 'End Conversation';
            } catch (e) {
                console.error('Error starting recognition:', e);
                document.getElementById('status').textContent = 'Error starting recognition';
                conversationActive = false;
            }
        } else {
            document.getElementById('status').textContent = 'Could not access microphone';
            conversationActive = false;
        }
    } else {
        conversationActive = false;
        isProcessing = false;
        
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
            recognitionTimeout = null;
        }
        
        if (recognition) {
            try {
                recognition.stop();
            } catch (e) {
                console.log('Recognition was not running');
            }
        }
        
        stopMicrophone();
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        
        document.getElementById('startBtn').textContent = 'Start Conversation';
        document.getElementById('status').textContent = 'Status: Idle';
    }
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

let wakeLock = null;

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock released');
            });
            console.log('Wake Lock acquired');
        }
    } catch (err) {
        console.error('Wake Lock error:', err.message);
    }
}

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && conversationActive) {
        requestWakeLock();
    }
});

document.addEventListener('touchstart', function() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}, {once: true});

document.addEventListener('touchmove', function(e) {
    if (e.target.id === 'voiceCanvas') {
        e.preventDefault();
    }
}, { passive: false });
