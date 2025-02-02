(function ($) {
  "use strict";

  $.extend($.fn.cycle.defaults, {
    autoHeight: 0, // setting this option to false disables autoHeight logic
    autoHeightSpeed: 250, autoHeightEasing: null
  });

  $(document).on('cycle-initialized', function (e, opts) {
    var autoHeight = opts.autoHeight;
    var t = $.type(autoHeight);
    var resizeThrottle = null;
    var ratio;

    if (t !== 'string' && t !== 'number') return;

    // bind events
    opts.container.on('cycle-slide-added cycle-slide-removed', initAutoHeight);
    opts.container.on('cycle-destroyed', onDestroy);

    if (autoHeight == 'container') {
      opts.container.on('cycle-before', onBefore);
    } else if (t === 'string' && /\d+\:\d+/.test(autoHeight)) {
      // use ratio
      ratio = autoHeight.match(/(\d+)\:(\d+)/);
      ratio = ratio[1] / ratio[2];
      opts._autoHeightRatio = ratio;
    }

    // if autoHeight is a number then we don't need to recalculate the sentinel
    // index on resize
    if (t !== 'number') {
      // bind unique resize handler per slideshow (so it can be 'off-ed' in onDestroy)
      opts._autoHeightOnResize = function () {
        clearTimeout(resizeThrottle);
        resizeThrottle = setTimeout(onResize, 50);
      };

      $(window).on('resize orientationchange', opts._autoHeightOnResize);
    }

    setTimeout(onResize, 30);

    opts.container.on('first-image-shown-cycle-on-ios', onResize);

    function onResize() {
      initAutoHeight(e, opts);
    }
  });

  function initAutoHeight(e, opts) {
    var clone, height, sentinelIndex;
    var autoHeight = opts.autoHeight;
    opts.heighIndex = opts.heighIndex ? opts.heighIndex : [];
    opts.requiredRebuild = true;
    if (autoHeight == 'container') {
      height = $(opts.slides[opts.currSlide]).outerHeight();
      opts.container.height(height);
    } else if (opts._autoHeightRatio) {
      opts.container.height(opts.container.width() / opts._autoHeightRatio);
    } else if (autoHeight === 'calc' || ($.type(autoHeight) == 'number' && autoHeight >= 0)) {
      if (autoHeight === 'calc') {
        if (opts._sentinel) {
          opts._sentinel.remove();
        }
        sentinelIndex = calcSentinelIndex(e, opts);
      } else if (autoHeight >= opts.slides.length) {
        sentinelIndex = 0;
      } else {
        sentinelIndex = autoHeight;
      }
      
      if (opts._sentinel) {
        // only recreate sentinel if index is different or container's height is 0
        if (sentinelIndex == opts._sentinelIndex && opts.container.height() !== 0) {
          return;
        }

        if (opts.autoHeightResizeOncePerSize && !opts.requiredRebuild) {
          return;
        }
      }

      opts._sentinelIndex = sentinelIndex;
      if (opts._sentinel) opts._sentinel.remove();

      // clone existing slide as sentinel
      clone = $(opts.slides[sentinelIndex].cloneNode(true));

      // #50; remove special attributes from cloned content
      clone.removeAttr('id name rel').find('[id],[name],[rel]').removeAttr('id name rel');

      clone.css({
        position: 'static', visibility: 'hidden', display: 'block'
      }).prependTo(opts.container).addClass('cycle-sentinel cycle-slide').removeClass('cycle-slide-active');
      clone.find('*').css('visibility', 'hidden');

      opts._sentinel = clone;
    }
  }

  function calcSentinelIndex(e, opts) {
    var index = 0, max = -1;

    // calculate tallest slide index
    opts.slides.each(function (i) {
      var h = $(this).height();
      if (h > max) {
        max = h;
        index = i;
      }
    });
    if (opts.autoHeightResizeOncePerSize) {
      if (max in opts.heighIndex) {
        opts.requiredRebuild = false;
        return opts.heighIndex[max];
      }
      opts.heighIndex[max] = index;
    }
    return index;
  }

  function onBefore(e, opts, outgoing, incoming, forward) {
    var h = $(incoming).outerHeight();
    opts.container.animate({ height: h }, opts.autoHeightSpeed, opts.autoHeightEasing);
  }

  function onDestroy(e, opts) {
    if (opts._autoHeightOnResize) {
      $(window).off('resize orientationchange', opts._autoHeightOnResize);
      opts._autoHeightOnResize = null;
    }
    opts.container.off('cycle-slide-added cycle-slide-removed', initAutoHeight);
    opts.container.off('cycle-destroyed', onDestroy);
    opts.container.off('cycle-before', onBefore);

    if (opts._sentinel) {
      opts._sentinel.remove();
      opts._sentinel = null;
    }
  }

})(jQuery);
