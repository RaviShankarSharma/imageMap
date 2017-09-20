//Make sure jQuery has been loaded before app.js
if (typeof jQuery === "undefined") {
    throw new Error("SegmentManager requires jQuery");
  }
  
  function showDateDiff(startDate, endDate){
    var date1 = new Date(startDate);
    var date2 = new Date(endDate);
    
    var diff = (date2 - date1)/1000;
    var diff = Math.floor(diff);
    
    return Math.floor(diff/(24*60*60));
  }

  $.SegmentManager = {};
  $.SegmentManager.options = {
    navbarMenuSlimscroll: true,
    navbarMenuSlimscrollWidth: "3px", //The width of the scroll bar
    navbarMenuHeight: "200px", //The height of the inner menu
    animationSpeed: 500,
    sidebarToggleSelector: "[data-toggle='offcanvas']",
    sidebarPushMenu: true,
    sidebarSlimScroll: true,
    sidebarExpandOnHover: false,
    enableBoxRefresh: true,
    enableBSToppltip: true,
    BSTooltipSelector: "[data-toggle='tooltip']",
    enableFastclick: true,
    enableControlSidebar: true,
    controlSidebarOptions: {
      //Which button should trigger the open/close event
      toggleBtnSelector: "[data-toggle='control-sidebar']",
      //The sidebar selector
      selector: ".control-sidebar",
      //Enable slide over content
      slide: true
    },
  
  
    //Define the set of colors to use globally around the website
    colors: {
      lightBlue: "#3c8dbc",
      green: "#00a65a",
      blue: "#0073b7",
      navy: "#001F3F",
      black: "#222222",
      gray: "#d2d6de"
    },
    //The standard screen sizes that bootstrap uses.
    //If you change these in the variables.less file, change
    //them here too.
    screenSizes: {
      lg: 1200
    }
  };
  
  /* ------------------
   * - Implementation -
   * ------------------
   * The next block of code implements SegmentManager's
   * functions and plugins as specified by the
   * options above.
   */
  $(function () {
    "use strict";
  
    //Fix for IE page transitions
    $("body").removeClass("hold-transition");
  
  
    //Set up the object
    _init();
  
    //Activate the layout maker
    $.SegmentManager.layout.activate();
  
    //Enable sidebar tree view controls
    $.SegmentManager.tree('.sidebar');
  
  
  });
  
  /* ----------------------------------
   * - Initialize the SegmentManager Object -
   * ----------------------------------
   */
  function _init() {
    'use strict';
    $.SegmentManager.layout = {
      activate: function () {
        var _this = this;
        _this.fix();
        _this.fixSidebar();
        $(window, ".wrapper").resize(function () {
          _this.fix();
          _this.fixSidebar();
        });
      },
      fix: function () {
        //Get window height and the wrapper height
        var neg = $('.main-header').outerHeight() + $('.main-footer').outerHeight();
        var window_height = $(window).height();
        var sidebar_height = $(".sidebar").height();
        //Set the min-height of the content and sidebar based on the
        //the height of the document.
        if ($("body").hasClass("fixed")) {
          $(".content-wrapper, .right-side").css('min-height', window_height - neg);
        } else {
          var postSetWidth;
          $(".content-wrapper, .right-side").css('min-height', 980);
          postSetWidth = window_height - neg;
          
          //Fix for the control sidebar height
          var controlSidebar = $($.SegmentManager.options.controlSidebarOptions.selector);
          if (typeof controlSidebar !== "undefined") {
            if (controlSidebar.height() > postSetWidth)
              $(".content-wrapper, .right-side").css('min-height', controlSidebar.height());
          }
  
        }
      },
      fixSidebar: function () {
        //Make sure the body tag has the .fixed class
        if (!$("body").hasClass("fixed")) {
          if (typeof $.fn.slimScroll != 'undefined') {
            $(".sidebar").slimScroll({destroy: true}).height("auto");
          }
          return;
        } else if (typeof $.fn.slimScroll == 'undefined' && window.console) {
          window.console.error("Error: the fixed layout requires the slimscroll plugin!");
        }
        //Enable slimscroll for fixed layout
        if ($.SegmentManager.options.sidebarSlimScroll) {
          if (typeof $.fn.slimScroll != 'undefined') {
            //Destroy if it exists
            $(".sidebar").slimScroll({destroy: true}).height("auto");
            //Add slimscroll
            $(".sidebar").slimscroll({
              height: ($(window).height() - $(".main-header").height()) + "px",
              color: "rgba(0,0,0,0.2)",
              size: "3px"
            });
          }
        }
      }
    };
  
    /* Tree()
     * ======
     * Converts the sidebar into a multilevel
     * tree view menu.
     *
     * @type Function
     * @Usage: $.SegmentManager.tree('.sidebar')
     */
    $.SegmentManager.tree = function (menu) {
      var _this = this;
      var animationSpeed = $.SegmentManager.options.animationSpeed;
      $(document).on('click', menu + ' li a', function (e) {
        //Get the clicked link and the next element
        var $this = $(this);
        var checkElement = $this.next();
  
        //Check if the next element is a menu and is visible
        if ((checkElement.is('.treeview-menu')) && (checkElement.is(':visible')) && (!$('body').hasClass('sidebar-collapse'))) {
          //Close the menu
          checkElement.slideUp(animationSpeed, function () {
            checkElement.removeClass('menu-open');
            //Fix the layout in case the sidebar stretches over the height of the window
            //_this.layout.fix();
          });
          checkElement.parent("li").removeClass("active");
        }
        //If the menu is not visible
        else if ((checkElement.is('.treeview-menu')) && (!checkElement.is(':visible'))) {
          //Get the parent menu
          var parent = $this.parents('ul').first();
          //Close all open menus within the parent
          var ul = parent.find('ul:visible').slideUp(animationSpeed);
          //Remove the menu-open class from the parent
          ul.removeClass('menu-open');
          //Get the parent li
          var parent_li = $this.parent("li");
  
          //Open the target menu and add the menu-open class
          checkElement.slideDown(animationSpeed, function () {
            //Add the class active to the parent li
            checkElement.addClass('menu-open');
            parent.find('li.active').removeClass('active');
            parent_li.addClass('active');
            //Fix the layout in case the sidebar stretches over the height of the window
            _this.layout.fix();
          });
        }
        //if this isn't a link, prevent the page from being redirected
        if (checkElement.is('.treeview-menu')) {
          e.preventDefault();
        }
      });
    };
  }  