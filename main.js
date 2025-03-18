import './style.css';

const canvas = document.getElementById("voiceCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// API Configuration
const GEMINI_API_KEY = 'AIzaSyA-JDhI67yDNVolV0YbM9xKgKh9Bepd9F8';
const ELEVENLABS_API_KEYS = [
    'sk_54c7b718a54814fdc3af3377104c8db3ae2fee51794655fd',
    'sk_e5d6b834551a1f3651a62226b4eff992def7971ae06d9347',
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
    'sk_544c7917afd57a16e66686cbb7db12a64561ad20b49bab93',
    'sk_00755348bdace1c4007c84e98f4e7384e4374d1d2839d3cc',
    'sk_ed9253baf4138a234b388e9b0a764be115083671ca427e92',
    'sk_e9d5ba0edaee834844db9d738f50cdd2924b4d9e231906f9',
    'sk_88fb2d8f8849002f41bca63b75c05e091af3bb09e406e51d',
    'sk_dc0d7ce9c4308b74d6d99c1a57ee7fa928feb8a7ed91983a',
    'sk_6a803e9df57448c9e3e601bc8684be523d29d30f865c4cdf',
    'sk_8e0026441bdd691728371703b86f6d11851766f4a14771ad',
    'sk_0c9280f4cf423a329fee54888e3f6685bf5c438e49b2f1f2',
    'sk_d76e2a0c24a62d7717ea9fb83cdb9d52117b18d43d7e19b7',
    'sk_09f1ae74dcdd5461939267cf996be6a7c7673c02bbbf9a54',
    'sk_13512ba6675f9c093662d24007709b820a7d0948f7dc1ce3',
    'sk_d9e510eaf7a608a47d1bdb67e147775802eedfe51e5005e2',
    'sk_76935b93229cfa12a9a3409189181ae1205e9cc9d614ff14',
    'sk_e341c9e0cd268a199153e5dc3cb8bee6ce77508902fbc2df'
];
// const VOICE_ID = 'TxGEqnHWrfWFTfGW9XjX';
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

// Eye Animation State
let isAISpeaking = false;
let lastBlinkTime = 0;
let blinkState = 0; // 0 = open (kelopak mata tertutup), 1 = closed (kelopak mata terbuka)
let nextBlinkDelay = 0;
let eyeOpenness = 0; // 0 = open (kelopak mata tertutup), 1 = closed (kelopak mata terbuka)

// Audio Analysis for Speech Pauses
let lastAudioLevel = 0;
let pauseDetected = false;
let pauseThreshold = 20; // Adjust based on testing
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
    
    // Calculate blink effect
    const currentTime = Date.now();
    if (isAISpeaking) {
        if (currentTime - lastBlinkTime > nextBlinkDelay) {
            // Start new blink
            if (blinkState === 0) { // Jika mata terbuka (kelopak tertutup)
                blinkState = 1; // Kedipkan mata (kelopak terbuka)
                nextBlinkDelay = 150; // Time for blink to complete
            } else {
                blinkState = 0; // Kembalikan ke terbuka (kelopak tertutup)
                // Random delay between 2-6 seconds for next blink
                nextBlinkDelay = 2000 + Math.random() * 4000;
            }
            lastBlinkTime = currentTime;
        }
        
        // Smooth blink animation
        if (blinkState === 1 && eyeOpenness < 1) { // Saat berkedip (kelopak terbuka)
            eyeOpenness = Math.min(1, eyeOpenness + 0.15);
        } else if (blinkState === 0 && eyeOpenness > 0) { // Saat terbuka (kelopak tertutup)
            eyeOpenness = Math.max(0, eyeOpenness - 0.15);
        }
    } else {
        eyeOpenness = 0; // Mata terbuka (kelopak tertutup) saat tidak berbicara
    }

    // Draw eye white (sclera)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, eyeWidth, eyeHeight * (1 - eyeOpenness), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    
    // Draw iris
    const irisSize = size * 0.4;
    const irisX = x;
    const irisY = y;
    
    ctx.beginPath();
    ctx.arc(irisX, irisY, irisSize * (1 - eyeOpenness), 0, Math.PI * 2);
    ctx.fillStyle = '#5b3c24'; // Brown iris color
    ctx.fill();
    
    // Draw pupil
    const pupilSize = irisSize * 0.5;
    ctx.beginPath();
    ctx.arc(irisX, irisY, pupilSize * (1 - eyeOpenness), 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    // Add catchlight (eye highlight)
    if ((1 - eyeOpenness) > 0.5) {
        const highlightSize = pupilSize * 0.4;
        ctx.beginPath();
        ctx.arc(irisX + irisSize * 0.2, irisY - irisSize * 0.2, highlightSize * (1 - eyeOpenness), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
    }
    
    // Draw eyelids
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

// Refined Visualization Function - More Subtle and Controlled
function visualizeAudio() {
    if (!analyser) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrame;
    
    function draw() {
        animationFrame = requestAnimationFrame(draw);
        
        try {
            analyser.getByteFrequencyData(dataArray);
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw center visualization
            ctx.beginPath();
            
            const centerX = canvas.width/2;
            const centerY = canvas.height/2;
            
            const rawVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const volume = Math.min(rawVolume, 100);
            
            // Detect speech pauses for natural blinking
            if (isAISpeaking) {
                if (Math.abs(rawVolume - lastAudioLevel) > pauseThreshold) {
                    pauseDetected = true;
                    pauseDuration = 0;
                } else {
                    pauseDuration++;
                    if (pauseDuration > 10 && Math.random() < 0.1) { // Random chance to blink during pauses
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
            ctx.fillStyle = "white";
            ctx.shadowColor = "rgba(255, 255, 255, 0.6)";
            ctx.shadowBlur = 15;
            ctx.fill();
            
            // Draw eyes
            const eyeSize = 40;
            const eyeSpacing = baseRadius * 2.2;
            drawEye(centerX - eyeSpacing, centerY, eyeSize); // Left eye
            drawEye(centerX + eyeSpacing, centerY, eyeSize); // Right eye
            
            time += 0.008;
        } catch (e) {
            console.error('Error in visualization:', e);
            cancelAnimationFrame(animationFrame);
        }
    }
    
    draw();
}

// Update ElevenLabs playback to trigger eye animation
async function playElevenLabsSpeech(text) {
    let successfulKeyIndex = -1;

    for (let i = 0; i < ELEVENLABS_API_KEYS.length; i++) {
        try {
            console.log(`Trying ElevenLabs API key ${i+1}...`);
            document.getElementById('status').textContent = `Processing speech... (Server ${i+1})`;
            
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
                    isAISpeaking = true; // Start eye animation
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
                    isAISpeaking = false; // Stop eye animation
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

                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
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
                }
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

// Setup Web Speech API - Defer until user interaction
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
            
            // Add to conversation history
            conversationHistory.push({ role: 'user', text: transcript });
            console.log('User:', transcript);
            
            try {
                // Stop microphone temporarily while processing
                stopMicrophone();
                
                const geminiResponse = await fetchGemini(transcript);
                document.getElementById('status').textContent = `AI: ${geminiResponse.substring(0, 50)}...`;
                
                // Add AI response to conversation history
                conversationHistory.push({ role: 'ai', text: geminiResponse });
                console.log('AI:', geminiResponse);
                
                await playElevenLabsSpeech(geminiResponse);
                
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

// Gemini API Function with Full Memory and Personality
async function fetchGemini(transcript) {
    // System prompt that defines AI's personality and background
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

    // Use the entire conversation history for full context
    let prompt = transcript;
    
    if (conversationHistory.length > 0) {
        const fullHistory = conversationHistory.slice(0, -1);
        if (fullHistory.length > 0) {
            prompt = "Riwayat percakapan sebelumnya:\n" + 
                fullHistory.map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.text}`).join('\n') +
                "\n\nPesan baru: " + transcript;
        }
    }
    
    // Combine system context with user prompt
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
                        temperature: 0.9,  // Increased for more creative responses
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
    // Clear any existing timeout to prevent multiple recognition sessions
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
                    // Try again in 1 second if it failed
                    setTimeout(restartRecognition, 1000);
                }
            }, 200);
        }
    }, 500);
}

// Audio Processing Functions
async function setupAudioContext() {
    if (!isAudioContextSupported) {
        document.getElementById('status').textContent = 'AudioContext not supported in this browser';
        return false;
    }
    
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Create analyser only when we have proper audio context
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
        // First try to get user media to request permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micPermissionGranted = true;
        
        // Stop tracks immediately - we'll request again when needed
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

// Control Handlers
document.getElementById('startBtn').addEventListener('click', async () => {
    if (!conversationActive) {
        // On first click, setup recognition
        if (!recognition) {
            const recognitionSetup = setupSpeechRecognition();
            if (!recognitionSetup) {
                document.getElementById('status').textContent = 'Speech recognition not available';
                return;
            }
        }
        
        // Request audio permissions - needed for both microphone and audio context on mobile
        const micPermission = await requestMicrophonePermission();
        if (!micPermission) {
            document.getElementById('status').textContent = 'Microphone access required';
            return;
        }
        
        // Resume AudioContext if it was suspended (needed for iOS/Safari)
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

// Initialize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Wake lock to keep screen active during conversation (if supported)
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

// Ensure audio playback is allowed on iOS/Safari
document.addEventListener('touchstart', function() {
    // Create and play a silent audio context to enable future audio
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}, {once: true});

// Help prevent touchmove events from causing scrolling
document.addEventListener('touchmove', function(e) {
    if (e.target.id === 'voiceCanvas') {
        e.preventDefault();
    }
}, { passive: false });
