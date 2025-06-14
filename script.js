document.addEventListener('DOMContentLoaded', () => {
    const registrationForm = document.getElementById('registration-form');
    const registrationMessage = document.getElementById('registration-message');
    const userRegistrationSection = document.getElementById('user-registration');
    const videoGallerySection = document.getElementById('video-gallery');
    const videoListContainer = document.getElementById('video-list');
    const videoModal = document.getElementById('video-modal');
    const closeModalButton = document.querySelector('.close-button');
    const youtubePlayerDiv = document.getElementById('youtube-player');

    let player; // YouTube player instance
    let currentUserId = localStorage.getItem('userId'); // Try to get user ID from local storage

    // Function to initialize YouTube player (called by YouTube API)
    window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube IFrame API Ready");
    };

    const loadYouTubePlayer = (youtubeId) => {
        if (player) {
            player.loadVideoById(youtubeId);
        } else {
            player = new YT.Player(youtubePlayerDiv, {
                height: '390', // These are placeholder, actual size handled by CSS
                width: '640',
                videoId: youtubeId,
                playerVars: {
                    'playsinline': 1
                },
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange
                }
            });
        }
    };

    function onPlayerReady(event) {
        event.target.playVideo();
    }

    function onPlayerStateChange(event) {
        // You can add logic here if needed (e.g., track video completion)
    }

    // Function to open the video modal
    const openVideoModal = (youtubeId) => {
        videoModal.style.display = 'flex'; // Use flex to center
        loadYouTubePlayer(youtubeId);
    };

    // Function to close the video modal
    const closeVideoModal = () => {
        videoModal.style.display = 'none';
        if (player) {
            player.stopVideo(); // Stop the video when closing
            // Optional: Destroy player if not reusing, but reusing is often better for performance
            // player.destroy();
            // player = null;
            // youtubePlayerDiv.innerHTML = ''; // Clear the div if destroying
        }
    };

    closeModalButton.addEventListener('click', closeVideoModal);
    videoModal.addEventListener('click', (e) => {
        if (e.target === videoModal) { // Close if clicked outside the modal-content
            closeVideoModal();
        }
    });

    // Handle user registration form submission
    registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email })
            });

            const data = await response.json();

            if (response.ok) {
                registrationMessage.textContent = data.message;
                registrationMessage.style.color = 'green';
                currentUserId = data.userId;
                localStorage.setItem('userId', currentUserId); // Save user ID
                setTimeout(() => {
                    userRegistrationSection.style.display = 'none';
                    videoGallerySection.style.display = 'block';
                    fetchVideos(); // Load videos after registration
                }, 1000);
            } else {
                registrationMessage.textContent = data.message || 'Error registering user.';
                registrationMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Error:', error);
            registrationMessage.textContent = 'Network error or server unavailable.';
            registrationMessage.style.color = 'red';
        }
    });

    // Function to fetch and display videos
    const fetchVideos = async () => {
        try {
            const response = await fetch('/api/videos');
            const videos = await response.json();

            videoListContainer.innerHTML = ''; // Clear previous videos
            videos.forEach(video => {
                const videoItem = document.createElement('div');
                videoItem.classList.add('video-item');
                videoItem.innerHTML = `
                    <img src="https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg" alt="${video.title} thumbnail" class="thumbnail" data-youtube-id="${video.youtube_id}">
                    <h3>${video.title}</h3>
                    <p>${video.description}</p>
                    <div class="actions">
                        <button class="like-button" data-youtube-id="${video.youtube_id}">Like</button>
                        <span class="like-count">Likes: <span id="likes-${video.youtube_id}">${video.likes}</span></span>
                    </div>
                `;
                videoListContainer.appendChild(videoItem);
            });

            // Add event listeners for thumbnails and like buttons after they are created
            document.querySelectorAll('.thumbnail').forEach(thumbnail => {
                thumbnail.addEventListener('click', (e) => {
                    openVideoModal(e.target.dataset.youtubeId);
                });
            });

            document.querySelectorAll('.like-button').forEach(button => {
                button.addEventListener('click', handleLike);
            });

        } catch (error) {
            console.error('Error fetching videos:', error);
            videoListContainer.innerHTML = '<p style="color: red;">Failed to load videos. Please try again later.</p>';
        }
    };

    // Handle like button click
    const handleLike = async (e) => {
        if (!currentUserId) {
            alert('Please register first to like videos!');
            return;
        }

        const youtubeId = e.target.dataset.youtubeId;
        const likeCountSpan = document.getElementById(`likes-${youtubeId}`);
        const currentLikes = parseInt(likeCountSpan.textContent);

        try {
            const response = await fetch(`/api/videos/${youtubeId}/like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: currentUserId })
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message); // For simplicity, use alert
                likeCountSpan.textContent = currentLikes + 1; // Optimistically update
                e.target.disabled = true; // Disable button after liking
                e.target.textContent = 'Liked';
            } else {
                alert(data.message || 'Error liking video.');
            }
        } catch (error) {
            console.error('Error liking video:', error);
            alert('Network error or server unavailable.');
        }
    };

    // Initial check: if user ID exists, skip registration and show gallery
    if (currentUserId) {
        userRegistrationSection.style.display = 'none';
        videoGallerySection.style.display = 'block';
        fetchVideos();
    } else {
        userRegistrationSection.style.display = 'block';
        videoGallerySection.style.display = 'none';
    }
});
