/* ===========================================
   zeng-wang-lun.js — 赠汪伦演示文稿控制器
   高级动画系统：退出 + 进入同步
   =========================================== */

class SlidePresentation {
    constructor() {
        this.slides = document.querySelectorAll('.slide');
        this.dots = document.querySelectorAll('.nav-dot');
        this.currentSlide = 0;
        this.stage = document.getElementById('deckStage');
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.isAnimating = false;

        // Exit animation classes (all available)
        this.exitClasses = [
            'exit-fade', 'exit-slideLeft', 'exit-slideRight',
            'exit-zoom', 'exit-blur', 'exit-flipY', 'exit-flipX',
            'exit-slideUp', 'exit-slideDown', 'exit-rotate',
            'exit-wipeLeft', 'exit-wipeUp', 'exit-radial', 'exit-corner'
        ];

        // Enter animation classes (paired with direction)
        this.enterClasses = {
            forward: ['enter-fromRight', 'enter-scale', 'enter-fade', 'enter-flipY', 'enter-fromBottom'],
            backward: ['enter-fromLeft', 'enter-scale', 'enter-fade', 'enter-flipY', 'enter-fromTop']
        };

        this.setupStageScale();
        this.setupKeyboardNav();
        this.setupTouchNav();
        this.setupWheelNav();
        this.setupDotNav();
        this.setupVideoAutoAdvance();
        this.showSlide(0);
    }

    setupStageScale() {
        const scale = () => {
            const factor = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
            const x = (window.innerWidth - 1920 * factor) / 2;
            const y = (window.innerHeight - 1080 * factor) / 2;
            this.stage.style.transform = `translate(${x}px, ${y}px) scale(${factor})`;
        };
        scale();
        window.addEventListener('resize', scale);
    }

    setupKeyboardNav() {
        document.addEventListener('keydown', (e) => {
            if (e.target.isContentEditable) return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
                e.preventDefault();
                this.next();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
                e.preventDefault();
                this.prev();
            } else if (e.key === 'Home') {
                e.preventDefault();
                this.showSlide(0);
            } else if (e.key === 'End') {
                e.preventDefault();
                this.showSlide(this.slides.length - 1);
            }
        });
    }

    setupTouchNav() {
        document.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].screenX - this.touchStartX;
            const dy = e.changedTouches[0].screenY - this.touchStartY;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 50) return;
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) this.next(); else this.prev();
            } else {
                if (dy < 0) this.next(); else this.prev();
            }
        }, { passive: true });
    }

    setupWheelNav() {
        let wheelTimeout = false;
        document.addEventListener('wheel', (e) => {
            if (wheelTimeout) return;
            wheelTimeout = true;
            setTimeout(() => { wheelTimeout = false; }, 800);
            if (e.deltaY > 0) this.next(); else this.prev();
        }, { passive: true });
    }

    setupDotNav() {
        this.dots.forEach((dot) => {
            dot.addEventListener('click', () => {
                this.showSlide(parseInt(dot.dataset.index));
            });
        });
    }

    /**
     * Set up video auto-advance: when a video on a slide ends, go to next slide.
     * For videos with 'controls' attribute (manual playback), only set up ended event.
     * For autoplay videos, unmute and play when slide becomes active.
     */
    setupVideoAutoAdvance() {
        const videoSlides = this.slides.querySelectorAll('.video-transition-player');
        videoSlides.forEach((video) => {
            // Auto-advance on video end
            video.addEventListener('ended', () => {
                const slide = video.closest('.slide');
                if (slide) {
                    const index = Array.from(this.slides).indexOf(slide);
                    if (index === this.currentSlide) {
                        this.next();
                    }
                }
            });

            // Only auto-play videos that don't have 'controls' (manual playback videos)
            if (!video.hasAttribute('controls')) {
                const observer = new MutationObserver(() => {
                    const slide = video.closest('.slide');
                    if (slide && slide.classList.contains('active')) {
                        video.muted = false;
                        video.play().catch(() => {});
                    }
                });
                const slide = video.closest('.slide');
                if (slide) {
                    observer.observe(slide, { attributes: true, attributeFilter: ['class'] });
                }
            }
        });
    }

    /**
     * Pick a random item from an array
     */
    pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Show a slide with synchronized exit + enter animations
     *
     * Flow:
     * 1. Current slide gets an exit animation class → plays exit
     * 2. Next slide gets an enter animation class → plays enter (simultaneously)
     * 3. After both complete, clean up and mark next as active
     */
    showSlide(index) {
        if (this.isAnimating) return;
        const target = Math.max(0, Math.min(index, this.slides.length - 1));
        if (target === this.currentSlide) return;

        const current = this.slides[this.currentSlide];
        const next = this.slides[target];
        const goingForward = target > this.currentSlide;

        this.isAnimating = true;

        // --- 1. Pick exit animation for current slide ---
        // Remove any previous animation classes
        current.classList.remove(...this.exitClasses, 'entering', 'active');

        // Pick exit class based on direction
        let exitClass;
        if (goingForward) {
            exitClass = this.pickRandom([
                'exit-slideLeft', 'exit-fade', 'exit-zoom',
                'exit-blur', 'exit-flipY', 'exit-rotate',
                'exit-wipeLeft', 'exit-radial', 'exit-corner'
            ]);
        } else {
            exitClass = this.pickRandom([
                'exit-slideRight', 'exit-fade', 'exit-zoom',
                'exit-blur', 'exit-flipX', 'exit-rotate',
                'exit-wipeUp', 'exit-radial', 'exit-corner'
            ]);
        }

        // Make current visible and start exit animation
        current.style.visibility = 'visible';
        current.style.opacity = '1';
        current.classList.add('exiting', exitClass);

        // --- 2. Prepare and start enter animation for next slide ---
        next.classList.remove(...this.exitClasses, 'exiting', 'active');
        next.style.visibility = 'visible';
        next.style.opacity = '1';

        // Pick enter class based on direction
        const enterPool = goingForward ? this.enterClasses.forward : this.enterClasses.backward;
        const enterClass = this.pickRandom(enterPool);
        next.classList.add('entering', enterClass);

        // --- 3. Update dots ---
        this.dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === target);
        });

        // --- 4. Wait for animations to complete ---
        // Use the longer of the two durations
        const animDuration = Math.max(800, 600); // enter: 0.8s, exit: 0.6s

        const cleanup = () => {
            // Clean up current slide
            current.classList.remove('exiting', exitClass, ...this.exitClasses);
            current.style.visibility = 'hidden';
            current.style.opacity = '0';

            // Clean up next slide
            next.classList.remove('entering', enterClass, ...this.enterClasses.forward, ...this.enterClasses.backward);
            next.classList.add('active');

            this.currentSlide = target;
            this.isAnimating = false;
        };

        // Use animationend on the next slide (the one entering)
        // since it has the longer animation
        const onEnterEnd = () => {
            next.removeEventListener('animationend', onEnterEnd);
            cleanup();
        };
        next.addEventListener('animationend', onEnterEnd);

        // Fallback timeout
        setTimeout(() => {
            if (this.isAnimating) {
                next.removeEventListener('animationend', onEnterEnd);
                cleanup();
            }
        }, animDuration + 200);
    }

    next() {
        if (this.currentSlide < this.slides.length - 1) {
            this.showSlide(this.currentSlide + 1);
        }
    }

    prev() {
        if (this.currentSlide > 0) {
            this.showSlide(this.currentSlide - 1);
        }
    }
}

// Initialize directly (script is at end of body, so DOM is ready)
window.__slidePresentation = new SlidePresentation();
