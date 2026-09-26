/*
|--------------------------------------------------------------------------
| voicevideo.js
|--------------------------------------------------------------------------
|
| Handles the Audio / Video source toggle in Voice Studio (Step 01).
|
| This ONLY updates the upload area's copy, icon, accept type, and size
| hint when the user taps Audio or Video, and keeps #mediaTypeSwitch's
| data-media-mode attribute in sync. It does NOT own upload/validation/
| submit logic -- that still lives in voice.js, which should read
| data-media-mode on #mediaTypeSwitch to know whether to validate/send
| the file as audio or video, and to show/hide #sourceAudio vs
| #sourceVideo and #resultAudio vs #resultVideo when previewing or
| displaying results.
|
|--------------------------------------------------------------------------
*/

(function () {

    var AUDIO_ACCEPT = 'audio/mpeg';
    var VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm';

    var switchEl = document.getElementById('mediaTypeSwitch');

    if (!switchEl) {
        return;
    }

    var audioButton = document.getElementById('mediaTypeAudioButton');
    var videoButton = document.getElementById('mediaTypeVideoButton');
    var audioInput = document.getElementById('audioInput');

    var icon = document.getElementById('uploadAreaIcon');
    var title = document.getElementById('uploadAreaTitle');
    var description = document.getElementById('uploadAreaDescription');
    var buttonLabel = document.getElementById('selectAudioButtonLabel');
    var hint = document.getElementById('uploadAreaHint');


    function setMode(mode) {

        var isAudio = mode === 'audio';

        switchEl.setAttribute('data-media-mode', mode);

        audioButton.classList.toggle('active', isAudio);
        videoButton.classList.toggle('active', !isAudio);

        audioInput.setAttribute(
            'accept',
            isAudio ? AUDIO_ACCEPT : VIDEO_ACCEPT
        );

        icon.className = isAudio ? 'bi bi-mic' : 'bi bi-camera-video';

        title.textContent = isAudio
            ? 'Upload your voice'
            : 'Upload your video';

        description.textContent = isAudio
            ? 'Select an MP3 recording to transform with AI.'
            : 'Select a video file to transform its voice with AI.';

        buttonLabel.textContent = isAudio
            ? 'Choose Audio'
            : 'Choose Video';

        hint.textContent = isAudio
            ? 'MP3 · Maximum 5 MB'
            : 'MP4, MOV, WEBM · Maximum 25 MB';

        // Let voice.js (and anything else listening) know the mode changed.
        switchEl.dispatchEvent(
            new CustomEvent('mediamodechange', {
                detail: { mode: mode }
            })
        );
    }


    audioButton.addEventListener('click', function () {
        setMode('audio');
    });

    videoButton.addEventListener('click', function () {
        setMode('video');
    });

})();
