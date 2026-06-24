/*
	Dimension by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/



function submitAndResetForm() {
	//After posting make sure to reset the message box for if you want to send other messages 
    document.getElementById("contactForm").submit();
	document.getElementById('message').value = "";
}




(function($) {

	var	$window = $(window),
		$body = $('body'),
		$wrapper = $('#wrapper'),
		$header = $('#header'),
		$footer = $('#footer'),
		$main = $('#main'),
		$main_articles = $main.children('article');

	// Breakpoints.
		breakpoints({
			xlarge:   [ '1281px',  '1680px' ],
			large:    [ '981px',   '1280px' ],
			medium:   [ '737px',   '980px'  ],
			small:    [ '481px',   '736px'  ],
			xsmall:   [ '361px',   '480px'  ],
			xxsmall:  [ null,      '360px'  ]
		});


	// Fix: Flexbox min-height bug on IE.
		if (browser.name == 'ie') {

			var flexboxFixTimeoutId;

			$window.on('resize.flexbox-fix', function() {

				clearTimeout(flexboxFixTimeoutId);

				flexboxFixTimeoutId = setTimeout(function() {

					if ($wrapper.prop('scrollHeight') > $window.height())
						$wrapper.css('height', 'auto');
					else
						$wrapper.css('height', '100vh');

				}, 250);

			}).triggerHandler('resize.flexbox-fix');

		}

	// Nav.
		var $nav = $header.children('nav'),
			$nav_li = $nav.find('li');

		// Add "middle" alignment classes if we're dealing with an even number of items.
			if ($nav_li.length % 2 == 0) {

				$nav.addClass('use-middle');
				$nav_li.eq( ($nav_li.length / 2) ).addClass('is-middle');

			}

		// Ensure hash navigation always fires, regardless of CSS/JS embellishments.
			$nav.find('a[href^="#"]').on('click', function(event) {
				var $link = $(this);
				var targetHash = $link.attr('href');
				if (!targetHash || targetHash.length < 2) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				if (location.hash === targetHash) {
					$main._show(targetHash.substring(1));
					return;
				}
				location.hash = targetHash;
			});

		initializeNavButtonParallax();
		initializeLogoParallax();

		function initializeLogoParallax() {
		if (typeof document === 'undefined') {
			return;
		}

		var logoContainer = document.querySelector('#header .logo');
		var logoImage = document.querySelector('#header .logo .logoImg');
		if (!logoContainer || !logoImage) {
			return;
		}

		var hasFinePointer = typeof window !== 'undefined'
			&& window.matchMedia
			&& window.matchMedia('(pointer: fine)').matches;

		if (!hasFinePointer) {
			return;
		}

		var supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
		var scheduleFrame = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
			? window.requestAnimationFrame.bind(window)
			: function(callback) { return setTimeout(callback, 0); };
		var moveEvent = supportsPointer ? 'pointermove' : 'mousemove';
		var leaveEvent = supportsPointer ? 'pointerleave' : 'mouseleave';
		var rafHandle = null;
		var pendingValues = null;

		logoContainer.addEventListener(moveEvent, handleMove, { passive: true });
		logoContainer.addEventListener(leaveEvent, function() {
			pendingValues = null;
			resetLogoState();
		}, { passive: true });

		function handleMove(event) {
			if (event.type === 'pointermove' && event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
				return;
			}

			var rect = logoContainer.getBoundingClientRect();
			var relativeX = ((event.clientX - rect.left) / rect.width) - 0.5;
			var relativeY = ((event.clientY - rect.top) / rect.height) - 0.5;

			relativeX = Math.max(-0.65, Math.min(relativeX || 0, 0.65));
			relativeY = Math.max(-0.65, Math.min(relativeY || 0, 0.65));

			var influence = Math.min(Math.abs(relativeX) + Math.abs(relativeY), 1);
			var rotateX = (-relativeY * 28).toFixed(2);
			var rotateY = (relativeX * 28).toFixed(2);
			var depth = (1 - influence) * 42;
			var scale = 1.035 + (0.035 * (1 - influence));

			pendingValues = {
				rotateX: rotateX,
				rotateY: rotateY,
				depth: depth,
				scale: scale
			};

			if (!rafHandle) {
				rafHandle = (typeof window !== 'undefined' && window.requestAnimationFrame)
					? window.requestAnimationFrame(applyLogoTransform)
					: setTimeout(applyLogoTransform, 0);
			}
		}

		function applyLogoTransform() {
			rafHandle = null;
			if (!pendingValues) {
				return;
			}
			logoImage.style.setProperty('--logoRotateX', pendingValues.rotateX + 'deg');
			logoImage.style.setProperty('--logoRotateY', pendingValues.rotateY + 'deg');
			logoImage.style.setProperty('--logoTranslateZ', pendingValues.depth.toFixed(2) + 'px');
			logoImage.style.setProperty('--logoScale', pendingValues.scale.toFixed(3));
		}

		function resetLogoState() {
			logoImage.style.setProperty('--logoRotateX', '0deg');
			logoImage.style.setProperty('--logoRotateY', '0deg');
			logoImage.style.setProperty('--logoTranslateZ', '0px');
			logoImage.style.setProperty('--logoScale', '1');
		}
	}

		function initializeNavButtonParallax() {
		if (typeof document === 'undefined') {
			return;
		}


		var navButtons = document.querySelectorAll('#header nav ul li a');
		if (!navButtons.length) {
			return;
		}

		var canAnimate = typeof window !== 'undefined'
			&& window.matchMedia
			&& window.matchMedia('(pointer: fine)').matches;

		if (!canAnimate) {
			return;
		}

		var supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
		var raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
			? window.requestAnimationFrame.bind(window)
			: function(callback) { return setTimeout(function() { callback(Date.now()); }, 16); };
		var cancelFrame = typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
			? window.cancelAnimationFrame.bind(window)
			: function(id) { clearTimeout(id); };
		var smoothResets = new WeakMap();

		navButtons.forEach(function(button) {
			applyButtonDynamics(button, 0.5, 0.5);

			if (supportsPointer) {
				button.addEventListener('pointermove', handlePointerMove, { passive: true });
				button.addEventListener('pointerleave', handlePointerLeave, { passive: true });
			} else {
				button.addEventListener('mousemove', handlePointerMove, { passive: true });
				button.addEventListener('mouseleave', handlePointerLeave, { passive: true });
			}

			button.addEventListener('blur', function() {
				startSmoothReturn(button);
			});
		});

		function handlePointerMove(event) {
			if (event.type === 'pointermove' && event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
				return;
			}

			var target = event.currentTarget;
			if (!target) {
				return;
			}

			cancelSmoothReturn(target);

			var rect = target.getBoundingClientRect();
			var relativeX = (event.clientX - rect.left) / rect.width;
			var relativeY = (event.clientY - rect.top) / rect.height;

			relativeX = Math.max(0, Math.min(relativeX || 0, 1));
			relativeY = Math.max(0, Math.min(relativeY || 0, 1));

			applyButtonDynamics(target, relativeX, relativeY);
		}

		function handlePointerLeave(event) {
			if (event && event.currentTarget) {
				startSmoothReturn(event.currentTarget);
			}
		}

		function startSmoothReturn(target) {
			cancelSmoothReturn(target);

			var startX = parseFloat(target.dataset.navGlowX || '0.5');
			var startY = parseFloat(target.dataset.navGlowY || '0.5');
			var duration = 500;
			var startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

			function step(now) {
				var progress = Math.min((now - startTime) / duration, 1);
				var eased = 1 - Math.pow(1 - progress, 3);
				var currentX = startX + (0.5 - startX) * eased;
				var currentY = startY + (0.5 - startY) * eased;
				applyButtonDynamics(target, currentX, currentY);

				if (progress < 1) {
					var frameId = raf(step);
					smoothResets.set(target, frameId);
				} else {
					smoothResets.delete(target);
				}
			}

			var frameId = raf(step);
			smoothResets.set(target, frameId);
		}

		function cancelSmoothReturn(target) {
			var frameId = smoothResets.get(target);
			if (typeof frameId === 'number') {
				cancelFrame(frameId);
				smoothResets.delete(target);
			}
		}

		function applyButtonDynamics(target, relativeX, relativeY) {
			var tiltX = (0.5 - relativeY) * 18;
			var tiltY = (relativeX - 0.5) * 26;

			target.dataset.navGlowX = relativeX.toFixed(4);
			target.dataset.navGlowY = relativeY.toFixed(4);

			target.style.setProperty('--glowX', (relativeX * 100).toFixed(2) + '%');
			target.style.setProperty('--glowY', (relativeY * 100).toFixed(2) + '%');
			target.style.setProperty('--tiltX', tiltX.toFixed(2) + 'deg');
			target.style.setProperty('--tiltY', tiltY.toFixed(2) + 'deg');
		}
	}

	// Main.
		var	delay = 325,
			locked = false;

		// Methods.
			$main._show = function(id, initial) {

				var $article = $main_articles.filter('#' + id);

				// No such article? Bail.
					if ($article.length == 0)
						return;

				// Handle lock.

					// Already locked? Speed through "show" steps w/o delays.
						if (locked || (typeof initial != 'undefined' && initial === true)) {

							// Mark as switching.
								$body.addClass('is-switching');

							// Mark as visible.
								$body.addClass('is-article-visible');

							// Deactivate all articles (just in case one's already active).
								$main_articles.removeClass('active');

							// Hide header, footer.
								$header.hide();
								$footer.hide();

							// Show main, article.
								$main.show();
								$article.show();

							// Activate article.
								$article.addClass('active');

							// Unlock.
								locked = false;

							// Unmark as switching.
								setTimeout(function() {
									$body.removeClass('is-switching');
								}, (initial ? 1000 : 0));

							return;

						}

					// Lock.
						locked = true;

				// Article already visible? Just swap articles.
					if ($body.hasClass('is-article-visible')) {

						// Deactivate current article.
							var $currentArticle = $main_articles.filter('.active');

							$currentArticle.removeClass('active');

						// Show article.
							setTimeout(function() {

								// Hide current article.
									$currentArticle.hide();

								// Show article.
									$article.show();

								// Activate article.
									setTimeout(function() {

										$article.addClass('active');

										// Window stuff.
											$window
												.scrollTop(0)
												.triggerHandler('resize.flexbox-fix');

										// Unlock.
											setTimeout(function() {
												locked = false;
											}, delay);

									}, 25);

							}, delay);

					}

				// Otherwise, handle as normal.
					else {

						// Mark as visible.
							$body
								.addClass('is-article-visible');

						// Show article.
							setTimeout(function() {

								// Hide header, footer.
									$header.hide();
									$footer.hide();

								// Show main, article.
									$main.show();
									$article.show();

								// Activate article.
									setTimeout(function() {

										$article.addClass('active');

										// Window stuff.
											$window
												.scrollTop(0)
												.triggerHandler('resize.flexbox-fix');

										// Unlock.
											setTimeout(function() {
												locked = false;
											}, delay);

									}, 25);

							}, delay);

					}

			};

			$main._hide = function(addState) {

				var $article = $main_articles.filter('.active');

				// Article not visible? Bail.
					if (!$body.hasClass('is-article-visible'))
						return;

				// Add state?
					if (typeof addState != 'undefined'
					&&	addState === true)
						history.pushState(null, null, '#');

				// Handle lock.

					// Already locked? Speed through "hide" steps w/o delays.
						if (locked) {

							// Mark as switching.
								$body.addClass('is-switching');

							// Deactivate article.
								$article.removeClass('active');

							// Hide article, main.
								$article.hide();
								$main.hide();

							// Show footer, header.
								$footer.show();
								$header.show();

							// Unmark as visible.
								$body.removeClass('is-article-visible');

							// Unlock.
								locked = false;

							// Unmark as switching.
								$body.removeClass('is-switching');

							// Window stuff.
								$window
									.scrollTop(0)
									.triggerHandler('resize.flexbox-fix');

							return;

						}

					// Lock.
						locked = true;

				// Deactivate article.
					$article.removeClass('active');

				// Hide article.
					setTimeout(function() {

						// Hide article, main.
							$article.hide();
							$main.hide();

						// Show footer, header.
							$footer.show();
							$header.show();

						// Unmark as visible.
							setTimeout(function() {

								$body.removeClass('is-article-visible');

								// Window stuff.
									$window
										.scrollTop(0)
										.triggerHandler('resize.flexbox-fix');

								// Unlock.
									setTimeout(function() {
										locked = false;
									}, delay);

							}, 25);

					}, delay);


			};

		// Articles.
			$main_articles.each(function() {

				var $this = $(this);

				// Close.
					$('<div class="close">Close</div>')
						.appendTo($this)
						.on('click', function() {
							location.hash = '';
							
						});

				// Prevent clicks from inside article from bubbling.
					$this.on('click', function(event) {
						event.stopPropagation();
					});

			});

		// Events.
			$body.on('click', function(event) {

				// Article visible? Hide.
					if ($body.hasClass('is-article-visible'))
						$main._hide(true);

			});

			$window.on('keyup', function(event) {

				switch (event.keyCode) {

					case 27:

						// Article visible? Hide.
							if ($body.hasClass('is-article-visible'))
								$main._hide(true);

						break;

					default:
						break;

				}

			});

			$window.on('hashchange', function(event) {

				// Empty hash?
					if (location.hash == ''
					||	location.hash == '#') {

						// Prevent default.
							event.preventDefault();
							event.stopPropagation();

						// Hide.
							$main._hide();

					}

				// Otherwise, check for a matching article.
					else if ($main_articles.filter(location.hash).length > 0) {

						// Prevent default.
							event.preventDefault();
							event.stopPropagation();

						// Show article.
							$main._show(location.hash.substr(1));

					}

			});

		// Scroll restoration.
		// This prevents the page from scrolling back to the top on a hashchange.
			if ('scrollRestoration' in history)
				history.scrollRestoration = 'manual';
			else {

				var	oldScrollPos = 0,
					scrollPos = 0,
					$htmlbody = $('html,body');

				$window
					.on('scroll', function() {

						oldScrollPos = scrollPos;
						scrollPos = $htmlbody.scrollTop();

					})
					.on('hashchange', function() {
						$window.scrollTop(oldScrollPos);
					});

			}

		// Initialize.

			// Hide main, articles.
				$main.hide();
				$main_articles.hide();

			// Initial article.
				if (location.hash != ''
				&&	location.hash != '#')
					$window.on('load', function() {
						$main._show(location.hash.substr(1), true);
					});

})(jQuery);
