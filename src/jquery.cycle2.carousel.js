(function($) {
"use strict";

$( document ).on('cycle-bootstrap', function( e, opts, API ) {
    if ( opts.fx !== 'carousel' )
        return;

    API.getSlideIndex = function( el ) {
        var slides = this.opts()._carouselWrap.children();
        var i = slides.index( el );
        return i % slides.length;
    };

    // override default 'next' function
    API.next = function() {
        var count = opts.reverse ? -1 : 1;
        if ( opts.allowWrap === false && ( opts.currSlide + count ) > opts.slideCount - opts.carouselVisible )
            return;
        opts.API.advanceSlide( count );
        opts.API.trigger('cycle-next', [ opts ]).log('cycle-next');
    };

});


$.fn.cycle.transitions.carousel = {
    // transition API impl
    preInit: function( opts ) {
        opts.hideNonActive = false;

        opts.container.on('cycle-destroyed', $.proxy(this.onDestroy, opts.API));
        // override default API implementation
        opts.API.stopTransition = this.stopTransition;

        // issue #10
        for (var i=0; i < opts.startingSlide; i++) {
            opts.container.append( opts.slides[0] );
        }
    },

    // transition API impl
    postInit: function( opts ) {
        var pagerCutoffIndex, wrap;
        var vert = opts.carouselVertical;
        if (opts.carouselVisible && opts.carouselVisible > opts.slideCount)
            opts.carouselVisible = opts.slideCount - 1;
        var visCount = opts.carouselVisible || opts.slides.length;
        var slideCSS = { display: vert ? 'block' : 'inline-block', position: 'static' };
        var carouselDirection = opts.carouselDirection || 'left';
        // required styles
        opts.container.css({ position: 'relative', overflow: 'hidden', direction: this.isRightCarouselDirection(opts) ? 'rtl' : 'ltr' });
        opts.slides.css( slideCSS );

        opts._currSlide = opts.currSlide;

        // wrap slides in a div; this div is what is animated
        wrap = $('<div class="cycle-carousel-wrap"></div>')
            .css({ margin: 0, padding: 0, top: 0, position: 'absolute' });
        wrap.css({carouselDirection: 0});

        opts._carouselWrap = wrap;

        if ( !vert )
            wrap.css('white-space', 'nowrap');

        if ( opts.allowWrap !== false ) {
            // prepend and append extra slides so we don't see any empty space when we
            // near the end of the carousel.  for fluid containers, add even more clones
            // so there is plenty to fill the screen
            appendWrappedSlidesToWrap(opts);

            wrap.find('.cycle-slide-active').removeClass('cycle-slide-active');
            opts.slides.eq(opts.startingSlide).addClass('cycle-slide-active');
        } else {
            wrap.append(opts.slides);
        }

        opts.container.prepend(wrap);

        if ( opts.pager && opts.allowWrap === false ) {
            // hide "extra" pagers
            pagerCutoffIndex = opts.slideCount - visCount;
            $( opts.pager ).children().filter( ':gt('+pagerCutoffIndex+')' ).hide();
        }

        opts._nextBoundry = opts.slideCount - opts.carouselVisible;

        this.prepareDimensions( opts );
    },

    prepareDimensions: function( opts ) {
        var dim, offset, pagerCutoffIndex, tmp, j;
        var vert = opts.carouselVertical;
        var visCount = opts.carouselVisible || opts.slides.length;

        if ( opts.carouselFluid && opts.carouselVisible ) {
            if ( ! opts._carouselResizeThrottle ) {
            // fluid container AND fluid slides; slides need to be resized to fit container
                this.fluidSlides( opts );
            }
        }
        else if ( opts.carouselVisible && opts.carouselSlideDimension ) {
            dim = visCount * opts.carouselSlideDimension;
            opts.container[ vert ? 'height' : 'width' ]( dim );
        }
        else if ( opts.carouselVisible ) {
            dim = visCount * $(opts.slides[0])[vert ? 'outerHeight' : 'outerWidth'](true);
            opts.container[ vert ? 'height' : 'width' ]( dim );
        }
        // else {
        //     // fluid; don't size the container
        // }

        offset = ( opts.carouselOffset || 0 );
        if ( opts.allowWrap !== false ) {
            if ( opts.carouselSlideDimension ) {
                offset -= ( (opts.slideCount + opts.currSlide) * opts.carouselSlideDimension );
            }
            else {
                // calculate offset based on actual slide dimensions
                tmp = opts._carouselWrap.children();
                for (j=0; j < (opts.slideCount + opts.currSlide); j++) {
                    offset -= this[vert ? 'getSlideHeight' : 'getSlideWidth'](tmp[j]);
                }
            }
        }

        opts._carouselWrap.css( vert ? 'top' : (opts.carouselDirection || 'left'), offset );
    },

    fluidSlides: function( opts ) {
        var timeout;
        var slide = opts.slides.eq(0);
        var adjustment = slide.outerWidth() - slide.width();
        var prepareDimensions = this.prepareDimensions;

        // throttle resize event
        $(window).on( 'resize', resizeThrottle);

        opts._carouselResizeThrottle = resizeThrottle;
        onResize();

        function resizeThrottle() {
            clearTimeout( timeout );
            timeout = setTimeout( onResize, 20 );
        }

        function onResize() {
            opts._carouselWrap.stop( false, true );
            var slideWidth = opts.container.width() / opts.carouselVisible;
            slideWidth = Math.ceil( slideWidth - adjustment );
            opts._carouselWrap.children().width( slideWidth );
            if ( opts._sentinel )
                opts._sentinel.width( slideWidth );
            prepareDimensions( opts );
        }
    },

    // transition API impl
    transition: function( opts, curr, next, fwd, callback ) {
        var moveBy, props = {};
        var hops = opts.nextSlide - opts.currSlide;
        var vert = opts.carouselVertical;
        var speed = opts.speed;
        var carouselDirection = opts.carouselDirection || 'left';

        // handle all the edge cases for wrapping & non-wrapping
        if ( opts.allowWrap === false ) {
            fwd = hops > 0;
            var currSlide = opts._currSlide;
            var maxCurr = opts.slideCount - opts.carouselVisible;
            if ( hops > 0 && opts.nextSlide > maxCurr && currSlide == maxCurr ) {
                hops = 0;
            }
            else if ( hops > 0 && opts.nextSlide > maxCurr ) {
                hops = opts.nextSlide - currSlide - (opts.nextSlide - maxCurr);
            }
            else if ( hops < 0 && opts.currSlide > maxCurr && opts.nextSlide > maxCurr ) {
                hops = 0;
            }
            else if ( hops < 0 && opts.currSlide > maxCurr ) {
                hops += opts.currSlide - maxCurr;
            }
            else
                currSlide = opts.currSlide;

            moveBy = this.getScroll( opts, vert, currSlide, hops );
            opts.API.opts()._currSlide = opts.nextSlide > maxCurr ? maxCurr : opts.nextSlide;
        }
        else {
            if ( fwd && opts.nextSlide === 0 ) {
                // moving from last slide to first
                moveBy = this.getDim( opts, opts.currSlide, vert );
                callback = this.genCallback( opts, fwd, vert, callback );
            }
            else if ( !fwd && opts.nextSlide == opts.slideCount - 1 ) {
                // moving from first slide to last
                moveBy = this.getDim( opts, opts.currSlide, vert );
                callback = this.genCallback( opts, fwd, vert, callback );
            }
            else {
                moveBy = this.getScroll( opts, vert, opts.currSlide, hops );
            }
        }

        props[ vert ? 'top' : carouselDirection ] = fwd ? ( "-=" + moveBy ) : ( "+=" + moveBy );

        // throttleSpeed means to scroll slides at a constant rate, rather than
        // a constant speed
        if ( opts.throttleSpeed )
            speed = (moveBy / $(opts.slides[0])[vert ? 'height' : 'width']() ) * opts.speed;

        opts._carouselWrap.animate( props, speed, opts.easing, callback );
    },

    getDim: function( opts, index, vert ) {
        var slide = $( opts.slides[index] );
        return slide[ vert ? 'outerHeight' : 'outerWidth'](true);
    },

    getScroll: function( opts, vert, currSlide, hops ) {
        var i, moveBy = 0;

        if (hops > 0) {
            for (i=currSlide; i < currSlide+hops; i++)
                moveBy += this.getDim( opts, i, vert);
        }
        else {
            for (i=currSlide; i > currSlide+hops; i--)
                moveBy += this.getDim( opts, i, vert);
        }
        return moveBy;
    },

    genCallback: function(opts, fwd, vert, callback) {
        // returns callback fn that resets the left/top wrap position to the "real" slides
        return (function () {
            var index = opts.nextSlide;
            var pos;
            var offset;
            var numberOfAppendSlides;

            pos = $(opts.slides[index]).position();
            offset = 0 - pos[vert ? 'top' : 'left'] + (opts.carouselOffset || 0);

            if (this.isRightCarouselDirection(opts)) {
                numberOfAppendSlides = opts.carouselVisible === undefined ? opts.slideCount * 2 : opts.slideCount;
                numberOfAppendSlides = !fwd ? numberOfAppendSlides - 1 : numberOfAppendSlides;
                offset = -1 * (numberOfAppendSlides * this.getSlideWidth(opts.slides[opts.nextSlide]));
            }
            opts._carouselWrap.css(opts.carouselVertical ? 'top' : opts.carouselDirection, offset);
            callback();
        }).bind(this);
    },

    isRightCarouselDirection: function(opts) {
        return 'right' === opts.carouselDirection || false;
    },

    // core API override
    stopTransition: function() {
        var opts = this.opts();
        opts.slides.stop( false, true );
        opts._carouselWrap.stop( false, true );
    },

    // core API supplement
    onDestroy: function( e ) {
        var opts = this.opts();
        if ( opts._carouselResizeThrottle )
            $( window ).off( 'resize', opts._carouselResizeThrottle );
        opts.slides.prependTo( opts.container );
        opts._carouselWrap.remove();
    },

    /**
    * @param {HTMLElement} slide
    */
    getSlideWidth: function (slide) {
        try {
            return slide.getBoundingClientRect().width;
        } catch (error) {
            return 0;
        }
  },

    /**
    * @param {HTMLElement} slide
    */
    getSlideHeight: function (slide) {
        try {
            return slide.getBoundingClientRect().height;
        } catch (error) {
            return 0;
        }
    }
};

function appendWrappedSlidesToWrap(opts) {
    var slidesHtml = '';

    opts.slides.each(function (index, slide) {
        slidesHtml += slide.outerHTML;
    });

    if (opts.carouselVisible === undefined) {
        opts._carouselWrap.append(slidesHtml, slidesHtml, opts.slides, slidesHtml, slidesHtml);
    } else {
        opts._carouselWrap.append(slidesHtml, opts.slides, slidesHtml);
    }
}


})(jQuery);
