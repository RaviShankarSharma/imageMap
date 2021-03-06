'use strict'
var magnusNgAuth = angular.module('magnusNgAuth', ['ngIdle', 'http-auth-interceptor', 'ui.router', 'restangular']);

magnusNgAuth.provider('MagnusAuthSettings', [
    'IdleProvider',
    'KeepaliveProvider',
    function (IdleProvider, KeepaliveProvider) {
        var options = {
            //Properties
            logoutState: "logout",
            logoutAPI: "/app/logmeout",
            authAPI: "/app/rest/authenticated",
            accountAPI: "/app/rest/account",
            useIdleTimer: false,
            idleTime: 3600,
            idleTimeout: 60,
            idlePolling: 15,

            //Events
            onAuthComplete: function () { }, //params: isAuthenticated, isAuthorized, userAccount
            onAuthDestroy: function () { },
            onUnauthorized: function () { },
            onIdleStart: function () { }, //params: idle duration
            onIdleEnd: function () { },
            onIdleWarn: function () { } //params: countdown
        };
        return {
            set: function (newOptions) {
                angular.extend(options, newOptions);
                if (options.useIdleTimer === true) {
                    IdleProvider.idle(options.idleTime); //Idle count will start after 120 seconds
                    IdleProvider.timeout(options.idleTimeout); //After being Idle for 120 seconds, a timer will run for 60 seconds and if no activity found it will logout. Ideally this timeout < server session timeout duration
                    KeepaliveProvider.interval(options.idlePolling); // keep alive API will be called in 15 seconds interval
                    KeepaliveProvider.http(options.authAPI);
                }
            },
            $get: function () {
                return options;
            }
        };
    }]);

magnusNgAuth.config(['$urlRouterProvider', '$stateProvider',
    function ($urlRouterProvider, $stateProvider) {
        $stateProvider
            .state('logout', {
                url: '/logout',
                controller: ["$rootScope", function ($rootScope) {
                    $rootScope.$broadcast('event:auth-loginRequired');
                }],
                data: {
                    authorizedRoles: '*'
                }
            });
        $urlRouterProvider.deferIntercept();
    }]);

magnusNgAuth.run([
    '$rootScope',
    '$state',
    '$urlRouter',
    'authService',    
    'Restangular',
    'Idle',
    'MagnusAuthSession',
    'MagnusAuthSharedService',
    'MagnusAuthSettings',
    function ($rootScope, $state, $urlRouter, authService, Restangular, Idle, MagnusAuthSession, MagnusAuthSharedService, MagnusAuthSettings) {
        console.log('Authentication Started.');
        Restangular.all(MagnusAuthSettings.authAPI).customGET().then(
            function (data, status, headers, config) {
                console.log('Authentication Completed.');
                
                Restangular.all(MagnusAuthSettings.accountAPI).customGET()
                    .then(function (data, status, headers, config) {
                        MagnusAuthSession.create(data.lanId, data.firstName, data.lastName, data.email, data.roles, data.empId);
                        if (typeof MagnusAuthSettings.onAuthComplete === "function") {
                            MagnusAuthSettings.onAuthComplete();
                        }
                        $urlRouter.sync();
                        $urlRouter.listen();
                    },
                    function (error) {
                        console.log('Authorisation Failed.');
                        console.log("Redirecting to SSO Logout");
                        $rootScope.$broadcast("event:auth-loginRequired");
                    });
            },
            function (error) {
                console.log('Authentication Failed.');
                console.log("Redirecting to SSO Logout");
                $rootScope.$broadcast("event:auth-loginRequired");
            });

        $rootScope.$on('$stateChangeStart', function (event, next, toParams, fromState, fromParams, options) {
            if (!MagnusAuthSharedService.isAuthorized(next.data.authorizedRoles)) {
                console.log('Unauthorised.');
                if (MagnusAuthSharedService.isAuthenticated()) {
                    // user is not allowed
                    event.preventDefault();
                    if (typeof MagnusAuthSettings.onUnauthorized === "function") {
                        MagnusAuthSettings.onUnauthorized();
                    }
                    authService.loginConfirmed(MagnusAuthSession);
                } else {
                    // user is not logged in
                    $rootScope.$broadcast("event:auth-loginRequired");
                }                
            }
            else {
                console.log('Authorised.');
                authService.loginConfirmed(MagnusAuthSession);                
            }
            
        });

        // Call when the the client is confirmed
        $rootScope.$on('event:auth-loginConfirmed', function (data) {
            if (MagnusAuthSettings.useIdleTimer === true) {
                Idle.watch();
                console.log('Idle timer running...');
            }
        });

        // Call when the 401 response is returned by the server
        $rootScope.$on('event:auth-loginRequired', function (rejection) {
            MagnusAuthSession.destroy();
            if (typeof MagnusAuthSettings.onAuthDestroy === "function") {
                MagnusAuthSettings.onAuthDestroy();
            }

            MagnusAuthSharedService.logout();
        });

        // Call when the 403 response is returned by the server
        $rootScope.$on('event:auth-notAuthorized', function (rejection) {
            console.log("Redirecting to SSO Logout because te user is not authorized");
            MagnusAuthSharedService.logout();
        });

        // Call when the user logs out
        $rootScope.$on('event:auth-loginCancelled', function () {
            console.log("Redirecting to SSO Logout because the user has logged out");
            MagnusAuthSharedService.logout();
        });


        /**
         * Idle Timer
         */
        if (MagnusAuthSettings.useIdleTimer === true) {
            $rootScope.$on('IdleStart', function () {
                if (typeof MagnusAuthSettings.onIdleStart === "function") {
                    MagnusAuthSettings.onIdleStart(Idle.getIdle());
                }
            });

            $rootScope.$on('IdleEnd', function () {
                if (typeof MagnusAuthSettings.onIdleEnd === "function") {
                    MagnusAuthSettings.onIdleEnd();
                }
                Idle.watch();
            });

            $rootScope.$on('IdleWarn', function (e, countdown) {
                if (typeof MagnusAuthSettings.onIdleWarn === "function") {
                    MagnusAuthSettings.onIdleWarn(countdown);
                }
            });

            $rootScope.$on('IdleTimeout', function () {
                $state.go(MagnusAuthSettings.logoutState);
            });

            $rootScope.$on('KeepaliveResponse', function (event, data, status) {
                if (status !== 200) {
                    $state.go(MagnusAuthSettings.logoutState);
                }
            });
        }
        //// Idle timer ends


    }]);
magnusNgAuth.service('MagnusAuthSharedService', [
    'MagnusAuthSession',
    'MagnusAuthSettings',
    function(MagnusAuthSession, MagnusAuthSettings) {
        this.isAuthenticated = function() {
            return !!MagnusAuthSession.login;
        };

        this.isAuthorized = function(authorizedRoles) {
            if (!angular.isArray(authorizedRoles)) {
                if (authorizedRoles == '*') {
                    return true;
                }
                authorizedRoles = [ authorizedRoles ];
            }

            var isAuthorized = false;
            angular.forEach(authorizedRoles, function(authorizedRole) {
                var authorized = (!!MagnusAuthSession.login && MagnusAuthSession.userRoles.indexOf(authorizedRole) !== -1);

                if (authorized || authorizedRole == '*') {
                    isAuthorized = true;
                }
            });
            return isAuthorized;
        };

        this.logout = function() {
            MagnusAuthSession.destroy(function(){
                console.log("Redirecting to SSO Logout");
                window.location.href = MagnusAuthSettings.logoutAPI;
            });
        };
    }]);

magnusNgAuth.factory('MagnusAuthSession', [
    function () {
        this.create = function (login, firstName, lastName, email, userRoles, empId) {
            this.login = login;
            this.firstName = firstName;
            this.lastName = lastName;
            this.email = email;
            this.userRoles = userRoles;
            this.empId = empId;
        };
        this.destroy = function (cb) {
            delete this.login;
            delete this.firstName;
            delete this.lastName;
            delete this.email;
            delete this.userRoles;
            delete this.empId;
            if (typeof cb === 'function') {
                cb();
            }
        };
        return this;
    }]);
magnusNgAuth.directive('magnusAuthLogout', [function(){
    return {
        restrict : 'E',
        transclude: false,
        template : '<a ui-sref="{{logoutUrl}}"><span class="glyphicon glyphicon-log-out"></span> &nbsp;<span>Log out</span></a>',
        controller: ["$scope", "MagnusAuthSettings", function($scope, MagnusAuthSettings){
            $scope.logoutUrl = MagnusAuthSettings.logoutState;
        }]
    };
}]);
'use strict';

/* App Module */
angular.module('SegmentManager', ['magnusNgAuth', 'tmh.dynamicLocale', 'pascalprecht.translate', 'ui.router',
    'ui.bootstrap', 'ui.router.compat', 'restangular', 'ngNotify', 'ngCookies']);

angular.module('SegmentManager').config(['$urlRouterProvider', '$stateProvider', '$httpProvider', '$translateProvider', 'tmhDynamicLocaleProvider', 'MagnusAuthSettingsProvider', 'API',
    function ($urlRouterProvider, $stateProvider, $httpProvider, $translateProvider,
        tmhDynamicLocaleProvider, MagnusAuthSettingsProvider, MagnusNgMentionSettingsProvider, API) {

        MagnusAuthSettingsProvider.set({
            useIdleTimer: true,
            idleTime: 3600,
            idleTimeout: 60,
            idlePolling: 15
        });

        $urlRouterProvider.otherwise('/');
        $stateProvider.state('main', {
            url: '/',
            templateUrl: 'dashboard/dashboard.html',
            controller: 'SegmentManagerController',
            data: {
                authorizedRoles: '*',
                menu: {
                    name: 'Home',
                    order: 0,
                    glyphiconClass: 'glyphicon glyphicon-home'
                }
            }
        });

        // Initialize angular-translate
        $translateProvider.useStaticFilesLoader({
            prefix: 'i18n/',
            suffix: '.json'
        });

        $translateProvider.useSanitizeValueStrategy('sanitize');
        $translateProvider.preferredLanguage('en');

        $translateProvider.useCookieStorage();
        tmhDynamicLocaleProvider.localeLocationPattern('components/angular-i18n/angular-locale_{{locale}}.js');
        tmhDynamicLocaleProvider.useCookieStorage('NG_TRANSLATE_LANG_KEY');

    }]);

angular.module('SegmentManager').run(['$state', '$rootScope', '$location', 'MagnusAuthSettings', 'MagnusAuthSession', 'MagnusAuthSharedService', 'ngNotify',
    function ($state, $rootScope, $location, MagnusAuthSettings, MagnusAuthSession, MagnusAuthSharedService, ngNotify) {
        MagnusAuthSettings.onAuthComplete = function () {
            $rootScope.authenticated = MagnusAuthSharedService.isAuthenticated();
            $rootScope.isAuthorized = MagnusAuthSharedService.isAuthorized;
            $rootScope.account = MagnusAuthSession;

            //Menu settings
            var allStates = $state.get();
            $rootScope.menuItems = [];

            angular.forEach(allStates, function (state) {
                if (state.data && state.data.menu && $rootScope.isAuthorized(state.data.authorizedRoles)) {
                    var parent = _.find(allStates, function (o) {
                        return state.data.menu.parentState == o.name;
                    });
                    $rootScope.menuItems.push({
                        state: state.name,
                        name: state.data.menu.name,
                        order: state.data.menu.order,
                        glyphiconClass: state.data.menu.glyphiconClass,
                        parent: parent ? parent.name : null
                    });
                }
            });
        };

        MagnusAuthSettings.onUnauthorized = function () {
            ngNotify.set("Unauthorized Access: You are not allowed to view this page", 'error');
        };

        MagnusAuthSettings.onAuthDestroy = function () {
            $rootScope.authenticated = false;
            $rootScope.authenticationError = false;
        };

        MagnusAuthSettings.onIdleStart = function (idleTime) {
            ngNotify.set("There were no activity since last " + moment.duration(idleTime, "seconds").format("mm:ss", { trim: false }) + " minutes. Click anywhere to continue else you will be logged out in minutes - {{countdown}}");
        };

        MagnusAuthSettings.onIdleEnd = function () {

        };

        MagnusAuthSettings.onIdleWarn = function (countdown) {
            $rootScope.$apply(function () {
                $rootScope.countdown = moment.duration(countdown, "seconds").format("mm:ss", { trim: false });
            });
        };
    }]);

angular.module('SegmentManager').constant('API', {
    "LDAP": "ldap/api",
    "NOTIFICATIONS": "notifications/api",
    "CONFIG": "cache/api",
    "AUTHORIZATION": "auth/sec",
    "ACTIVITY": "activity/api",
});

//Make sure jQuery has been loaded before app.js
if (typeof jQuery === "undefined") {
    throw new Error("SegmentManager requires jQuery");
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
/**
 * SegmentManager web UI constants.
 */

var SERVICE_PREFIX = "http://10.100.40.220:8090/customerprofile/";
var ATTRIBUTE_LIST_SERVICE = "fetchattributes/";
var ATTRIBUTE_DETAILS_SERVICE = "getattributesvalue/";
var FILTERDATA_LIST_SERVICE = "getcustomerdata/";
var SAVE_SEGMENT_DEFINATION_SERVICES = "savesegmentdefinition";
var SEGMENT_LIST_SERVICE = "fetchallsegments/";
var UPDATE_SEGMENT_DATA_SERVICE = "updatesegments";
var UPDATE_SEGMENT_STATUS_SERVICE = "updatesegmentstatus";

var SEGMENT_LIST = [
    {
        "segmentId": "86103991712541936042017-08-24T14:47:41.476",
        "user": "currentUser",
        "createdDateTime": "2017-08-24T14:47:41.476",
        "segmentName": "state wise search",
        "segmentDefination": "state BC and UT",
        "segmentFilter": "state = BC,UT",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "8610399171254194088",
        "user": "NewUser",
        "createdDateTime": "2017-08-25T18:16:37.484",
        "segmentName": "sayonee",
        "segmentDefination": "test2",
        "segmentFilter": "mail_and_ship_12_months_spend <= 1483844.52",
        "segmentStatus": "Archive",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "8610399171254194028",
        "user": "NewUser",
        "createdDateTime": "2017-08-25T18:31:50.424",
        "segmentName": "fdd",
        "segmentDefination": "sdsfsf",
        "segmentFilter": "facilities_12_months_spend = 0",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "8610399171254193819",
        "user": "NewUser",
        "createdDateTime": "2017-08-25T15:13:36.215",
        "segmentName": "test25/08",
        "segmentDefination": "test25/08",
        "segmentFilter": "division=ATL",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "8610399171254193829",
        "user": "NewUser",
        "createdDateTime": "2017-08-25T18:08:44.225",
        "segmentName": "Test25/08 facilities",
        "segmentDefination": "FacilitiesCheck",
        "segmentFilter": "facilities_12_months_spend >= 12666162",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "86103991712541936042017-08-24T13:47:36.435",
        "user": "currentUser",
        "createdDateTime": "2017-08-24T13:47:36.435",
        "segmentName": "division24/08",
        "segmentDefination": "division24/08",
        "segmentFilter": "facilities_12_months_spend >= 12666162&division=NAT",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "8610399171254193719",
        "user": "NewUser",
        "createdDateTime": "2017-08-25T15:15:36.115",
        "segmentName": "satewise 25/08",
        "segmentDefination": "state wise 25/08",
        "segmentFilter": "state = ID",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "8610399171254194503",
        "user": "NewUser",
        "createdDateTime": "2017-08-25T15:17:08.899",
        "segmentName": "check test25/08",
        "segmentDefination": "check test25/08",
        "segmentFilter": "facilities_12_months_spend >= 12666162",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "8610399171254194257",
        "user": "NewUser",
        "createdDateTime": "2017-08-25T18:12:35.653",
        "segmentName": "ssssss",
        "segmentDefination": "assssss",
        "segmentFilter": "facilities_12_months_spend >= 2404670.96",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "8610399171254193688",
        "user": "NewUser",
        "createdDateTime": "2017-08-25T18:14:20.084",
        "segmentName": "suman",
        "segmentDefination": "asadasa",
        "segmentFilter": "facilities_12_months_spend = 3924891.96",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "86103991712541936042017-08-24T15:45:29.036",
        "user": "NewUser",
        "createdDateTime": "2017-08-24T15:45:29.036",
        "segmentName": "rch24/08",
        "segmentDefination": "rch",
        "segmentFilter": "division = RCH",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "86103991712541936042017-08-25T12:59:40.563",
        "user": "NewUser",
        "createdDateTime": "2017-08-25T12:59:40.563",
        "segmentName": "dfff",
        "segmentDefination": "fdgdg",
        "segmentFilter": "facilities_12_months_spend <= 0",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "8610399171254194571",
        "user": "NewUser",
        "createdDateTime": "2017-08-25T18:30:47.967",
        "segmentName": "kunal",
        "segmentDefination": "faciliies",
        "segmentFilter": "facilities_12_months_spend <= 7472073.96",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    },
    {
        "segmentId": "8610399171254194052",
        "user": "NewUser",
        "createdDateTime": "2017-08-28T12:38:15.448",
        "segmentName": "Test28/08",
        "segmentDefination": "Test28/08",
        "segmentFilter": "facilities_12_months_spend >= 12666162",
        "segmentStatus": "Active",
        "segmentCategory": "ACCOUNT_CUSTOMER"
    }
];


var ATTRIBUTE_LIST_UPDATED = {
   "ACCOUNT_CUSTOMER_BANK":{
      "Category_Spend":[
         {
            "name":"paper_6_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"promo_3_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"office_supplies_24_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"promo_12_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"furniture_24_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"furniture_3_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"paper_3_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"facilities_12_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"furniture_12_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"toner_3_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"office_supplies_3_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"tech_24_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"facilities_6_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"toner_12_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"paper_24_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"print_6_months_spend ",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"promo_24_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"facilities_24_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"food_and_brkrm_6_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"food_and_brkrm_12_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"paper_12_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"tech_3_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"mail_and_ship_3_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"tech_12_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"tech_6_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"office_supplies_12_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"print_24_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"mail_and_ship_6_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"food_and_brkrm_3_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"mail_and_ship_24_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"facilities_3_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"print_12_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"toner_24_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"toner_6_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"office_supplies_6_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"food_and_brkrm_24_mths_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"mail_and_ship_12_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"print_3_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"furniture_6_months_spend",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"promo_6_months_spend",
            "type":"string",
            "isAdded":false
         }
      ],
      "Identifier":[
         {
            "name":"account_type_code",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"company",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"account_number",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"src_sys_code",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"account_type",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"division",
            "type":"string",
            "isAdded":false
         }
      ],
      "Firmographics":[
         {
            "name":"zip_code",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"state",
            "type":"string",
            "isAdded":false
         }
      ],
      "Membership":[
         {
            "name":"rewards_account_number",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"enrolled_prog",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"memb_start_date",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"rewards_tier",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"rewards_start_dat",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"memb_enrolled_flag",
            "type":"string",
            "isAdded":false
         },
         {
            "name":"memb_end_date",
            "type":"string",
            "isAdded":false
         }
      ]
   }
};

var TABLE_LIST = {
    "result_count": 85923,
    "dataList": [
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        },
        {
            "facilities_12_months_spend": "112.61",
            "food_and_brkrm_12_months_spend": "185.98",
            "furniture_24_months_spend": "245.44",
            "mail_and_ship_24_months_spend": "0.0",
            "promo_3_months_spend": "0.0",
            "toner_12_months_spend": "1215.2",
            "food_and_brkrm_6_months_spend": "22.48",
            "office_supplies_24_months_spend": "1609.04",
            "paper_12_months_spend": "527.12",
            "print_6_months_spend": "0.0",
            "promo_24_months_spend": "0.0",
            "promo_6_months_spend": "0.0",
            "toner_24_months_spend": "1326.38",
            "furniture_12_months_spend": "245.44",
            "furniture_3_months_spend": "0.0",
            "furniture_6_months_spend": "64.99",
            "mail_and_ship_12_months_spend": "0.0",
            "mail_and_ship_3_months_spend": "0.0",
            "mail_and_ship_6_months_spend": "0.0",
            "paper_6_months_spend": "97.97",
            "print_12_months_spend": "0.0",
            "print_3_months_spend": "0.0",
            "facilities_6_months_spend": "11.95",
            "food_and_brkrm_24_mths_spend": "185.98",
            "food_and_brkrm_3_months_spend": "0.0",
            "office_supplies_3_months_spend": "0.0",
            "office_supplies_6_months_spend": "478.38",
            "paper_24_months_spend": "561.11",
            "paper_3_months_spend": "0.0",
            "print_24_months_spend": "0.0",
            "promo_12_months_spend": "0.0",
            "tech_3_months_spend": "0.0",
            "tech_6_months_spend": "132.89",
            "toner_3_months_spend": "0.0",
            "toner_6_months_spend": "81.99",
            "facilities_24_months_spend": "112.61",
            "facilities_3_months_spend": "0.0",
            "office_supplies_12_months_spend": "1405.68",
            "tech_12_months_spend": "459.1",
            "tech_24_months_spend": "459.1",
            "account_number": "1635437",
            "account_type": "SCC",
            "account_type_code": "100021",
            "company": "001",
            "division": "LA",
            "src_sys_code": "08",
            "rewards_tier": "NA",
            "memb_end_date": null,
            "memb_enrolled_flag": "N",
            "memb_start_date": null,
            "enrolled_prog": null,
            "rewards_account_number": null,
            "rewards_start_date": null,
            "state": "ID",
            "zip_code": "83815"
        }],
    };

    var ATTRIBUTE_DESCRIPTION_ = {
        "maxValue":7512402.0,
        "minValue":-120000.0
        };

    var ATTRIBUTE_DESCRIPTION = [
        "DE",
        "TX",
        "FL",
        "NV",
        "WA",
        "NY",
        "SC",
        "SD",
        "WI",
        "MA",
        "MD",
        "IA",
        "ME",
        "OH",
        "GA",
        "ID",
        "MI",
        "OK",
        "CA",
        "WV",
        "UT",
        "MN",
        "WY",
        "MO",
        "IL",
        "OR",
        "IN",
        "MS",
        "MT",
        "KS",
        "AL",
        "VA",
        "CO",
        "KY",
        "PA",
        "CT",
        "AR",
        "NC",
        "LA",
        "NE",
        "RI",
        "AZ",
        "TN",
        "NH",
        "NJ",
        "VT",
        "DC",
        "NM"
        ];
    

angular.module('SegmentManager').controller('SegmentManagerController', ['$scope',
    function ($scope) {

        $scope.attr_val = true;
        $scope.save_flag = false;
        $scope.isArchive = false;
        $scope.isSegmentEdited = false;
        $scope.isSegmentSelected = false;
        $scope.selectedSegmentId = "";
        $scope.attributeIndx = 0;
        $scope.segementList = [];
        $scope.dataList = [];
        $scope.segmentNameList = [];
        $scope.segmentListData = [];
        $scope.segmentOriginalListData = [];
        $scope.segmentListFromService = [];
        $scope.attributesDescription = [];
        $scope.segmentFilterObjList = [];
        $scope.selAttributeObj = {};
        $scope.minValue = 0;
        $scope.maxValue = 0;
        $scope.selectedAttribute = "";
        $scope.selRadio = "=";
        $scope.filterDataObject = new Object();
        $scope.rangeSelectedOption = ">";
        $scope.rangeSelectedValue = 0;
        $scope.attributeListData = {};
        $scope.isRangeSelecter = false;
        $scope.ltValue = 0;
        $scope.gtValue = 0;
    
        $scope.isSegmentStateOption = false;
        $scope.isContainsOption = false;
        $scope.isCreatedByOption = false;
        $scope.isSegmentNameOption = false;
    
        $scope.segmentStateVal = "";
        $scope.containsVal = "";
        $scope.createdByVal = "";
        $scope.segmentNameVal = "";
    
    
        $scope.segmentFilterVal = "You can apply filter on segment";
    
        $scope.selectedSegmentIndx = 999;
    
        $scope.customerType = [
            {id:1, name : "ACCOUNT_CUSTOMER_BANK", label : "Account Customer"},
            {id:2, name : "CONTACT_CUSTOMER_BANK", label : "Contact Customer"}
        ];
    
        $scope.segmentType = [
            {id:1, name : "Active", label : "Active Segment"},
            {id:2, name : "Archive", label : "Archive Segment"}
        ];
    
        $scope.searchByType = [
            {id:1, name : "CREATED_BY", label : "Created By"},
            {id:2, name : "SEGMENT_STATUS", label : "Segment Status"},
            {id:3, name : "SEGMENT_NAME", label : "Segment Name"},
            {id:4, name : "CREATED_DATE", label : "Created Date"}
        ];
    
        $scope.rangeOptionList = [
            {id:1, name : ">", label : ">", isSelected : true},
            {id:2, name : ">=", label : ">=", isSelected : false},
            {id:2, name : "=", label : "=", isSelected : false},
            {id:2, name : "<=", label : "<=", isSelected : false},
            {id:2, name : "<", label : "<", isSelected : false}
        ];
         
        $scope.selectedSegmentId = 1;
        $scope.selectedSegment = {id:1, name : "ACTIVE_SEGMENT", label : "Active Segment"};
    
        $scope.selectedCuctomerId = 1;
        $scope.selectedCustomer = {id:1, name : "ACCOUNT_CUSTOMER_BANK", label : "Account Customer"};
    
        $scope.selectedSearchTypeId = 1;
        $scope.selectedSearchBy = {id:1, name : "CREATED_BY", label : "Created By"};
    
    
        $scope.isFirstScreen = true;
    
        var stringAtttribute = document.getElementById('string-popup');
        var numberAtttribute = document.getElementById('number-popup');
        var customerSegmentAtttribute = document.getElementById('customer-segment-popup');
        
        $scope.loadCustomerSegmentPopup = function(){
            customerSegmentAtttribute.style.display = "block";
        }

        $scope.attributeFilterOptions = function(strOptionName){
            if(strOptionName === "IN"){
                $scope.selRadio = "=";
                for(var i=0; i<$scope.attributesDescription.length; i++){
                    $scope.attributesDescription[i].isSelected = false;
                }
            }else{
                $scope.selRadio = "!=";
                for(var i=0; i<$scope.attributesDescription.length; i++){
                    $scope.attributesDescription[i].isSelected = false;
                }
            }
        }
    
        $scope.selectCustomerType = function(){
            if($scope.selectedCustomer.name === "ACCOUNT_CUSTOMER_BANK"){
                var objAttributesList = [
                    {"groupName":"Category_Spend", "attribute_list":$scope.attributeListData.ACCOUNT_CUSTOMER_BANK.Category_Spend},
                    {"groupName":"Identifier", "attribute_list":$scope.attributeListData.ACCOUNT_CUSTOMER_BANK.Identifier},
                    {"groupName":"Firmographics", "attribute_list":$scope.attributeListData.ACCOUNT_CUSTOMER_BANK.Firmographics},
                    {"groupName":"Membership", "attribute_list":$scope.attributeListData.ACCOUNT_CUSTOMER_BANK.Membership}
                ];
                
                $scope.attributes = objAttributesList;
            }else{
                var objAttributesList2 = [
                ];
                
                $scope.attributes = objAttributesList2;
            }
        }
    
        $scope.selectSegmentType = function(){
            $scope.load_segments();
        }
    
        $scope.selectOption = function(optionIndex){
            $scope.attributesDescription[optionIndex].isSelected = !$scope.attributesDescription[optionIndex].isSelected;
        }
    
        $scope.selectRangeOption = function(optionIndex){
            $scope.rangeOptionList[optionIndex].isSelected = !$scope.rangeOptionList[optionIndex].isSelected;
        }
    
        $scope.closePopup = function() {
            stringAtttribute.style.display = "none";
            numberAtttribute.style.display = "none";
            customerSegmentAtttribute.style.display = "none";
        }
    
        $scope.updateRangeSelection = function(optionType){
            $scope.rangeSelectedOption = optionType;
        }
    
        $scope.buildSegment = function(dataType){
            stringAtttribute.style.display = "none";
            numberAtttribute.style.display = "none";
            customerSegmentAtttribute.style.display = "none";
    
            var objSegment = "";
            var listSelOptions = [];
    
            if(dataType === "string"){
                for(var i=0; i<$scope.attributesDescription.length; i++){
                    if($scope.attributesDescription[i].isSelected){
                        listSelOptions.push($scope.attributesDescription[i].name); 
                    }
                }
    
                objSegment = $scope.selAttributeObj.attributeName + " " + $scope.selRadio + " " + listSelOptions.join(",");
            }else{
    
                if($scope.isRangeSelecter){
                    objSegment = $scope.selAttributeObj.attributeName + " >= " + $scope.gtValue + " & " + $scope.selAttributeObj.attributeName + " <= " + $scope.ltValue;
                }else{
                    objSegment = $scope.selAttributeObj.attributeName + " " + $scope.rangeSelectedOption + " " + $scope.rangeSelectedValue;
                }
            }
    
            $scope.updateAttributeDetails(objSegment);
        }
    
        $scope.deleteAttribute = function(attributeName, groupIndx) {
            for(var i=0; i < $scope.attributes[groupIndx].attribute_list.length; i++){
                if($scope.attributes[groupIndx].attribute_list[i].name === attributeName){
                    $scope.attributes[groupIndx].attribute_list[i].isAdded = false;
                }
            }
    
            for(var j = 0; j < $scope.segmentNameList.length; j++){
                if($scope.segmentNameList[j].attributeName === attributeName){
                    $scope.segmentNameList.splice(j, 1);
                    $scope.segementList.splice(j, 1);
                }
            }
        }
    
        $scope.removeDefination = function(rowIndx) {
            $scope.deleteAttribute($scope.segmentNameList[rowIndx].attributeName, $scope.segmentNameList[rowIndx].groupIndx)
        }
    
        $scope.updateAttributeDetails = function(groupObject) {
            for(var i=0; i < $scope.attributes[$scope.selAttributeObj.groupIndx].attribute_list.length; i++){
                if($scope.attributes[$scope.selAttributeObj.groupIndx].attribute_list[i].name === $scope.selAttributeObj.attributeName){
                    $scope.attributes[$scope.selAttributeObj.groupIndx].attribute_list[i].isAdded = true;
                    
                    $scope.segmentNameList.push({"attributeName" : $scope.selAttributeObj.attributeName, "groupIndx" : $scope.selAttributeObj.groupIndx});
                    $scope.segementList.push(groupObject);
                }
            } 
        }
    
        $scope.showAttributeDescription = function(attributeName, groupIndx) {
            //------------------------------------------------------------------
            var data = ATTRIBUTE_DESCRIPTION;
            $scope.loading = false;
            $scope.attributesDescription = [];
            if(Array.isArray(data)){
                for(var i=0; i<data.length; i++){
                    $scope.attributesDescription.push({"name":data[i], "isSelected":false});
                }
                $scope.minValue = 0;
                $scope.maxValue = 1000;
                numberAtttribute.style.display = "block";
            }else{
                $scope.minValue = data.minValue;
                $scope.maxValue = data.maxValue;
                numberAtttribute.style.display = "block";
            }
            $scope.selectedAttribute = attributeName;
            $scope.selAttributeObj = {"attributeName":attributeName, "groupIndx":groupIndx};
            //------------------------------------------------------------------
            /* $scope.loading = true;
            var loadAttributeData = $http.get(SERVICE_PREFIX + ATTRIBUTE_DETAILS_SERVICE + attributeName)
            .error(function(dataFromServer, status, headers, config) {
                var data = ATTRIBUTE_DESCRIPTION;
                $scope.loading = false;
                $scope.attributesDescription = [];
                if(Array.isArray(data)){
                    for(var i=0; i<data.length; i++){
                        $scope.attributesDescription.push({"name":data[i], "isSelected":false});
                    }
                    $scope.minValue = 0;
                    $scope.maxValue = 1000;
                    numberAtttribute.style.display = "block";
                }else{
                    $scope.minValue = data.minValue;
                    $scope.maxValue = data.maxValue;
                    numberAtttribute.style.display = "block";
                }
            })
            .success(function(data, status, headers, config) {
                $scope.loading = false;
                $scope.attributesDescription = [];
                if(Array.isArray(data)){
                    for(var i=0; i<data.length; i++){
                        $scope.attributesDescription.push({"name":data[i], "isSelected":false});
                    }
                    stringAtttribute.style.display = "block";
                }else{
                    $scope.minValue = data.minValue;
                    $scope.maxValue = data.maxValue;
                    numberAtttribute.style.display = "block";
                }
            });
    
            $scope.selectedAttribute = attributeName;
            $scope.selAttributeObj = {"attributeName":attributeName, "groupIndx":groupIndx}; */
        }
    
         $scope.load_segments = function() {
            //---------------------------
            $scope.segmentOriginalListData = SEGMENT_LIST;
            $scope.segmentListData = SEGMENT_LIST;
            $scope.segmentListFromService = SEGMENT_LIST;
            $scope.loading = false;
            //---------------------------

            /* $scope.loading = true;
            var segmentsService = $http.get(SERVICE_PREFIX + SEGMENT_LIST_SERVICE)
            .success(function(dataFromServer, status, headers, config) {
                $scope.segmentOriginalListData = dataFromServer;
                $scope.segmentListData = dataFromServer;
                $scope.segmentListFromService = dataFromServer;
                $scope.loading = false;
    
            })
            .error(function(dataFromServer, status, headers, config) {
                $scope.segmentOriginalListData = SEGMENT_LIST;
                $scope.segmentListData = SEGMENT_LIST;
                $scope.segmentListFromService = SEGMENT_LIST;
                $scope.loading = false;
            }); */
        };
    
        $scope.loadSegmentData = function(rowIndx, segmentStatus) {
            $scope.isArchive = (segmentStatus === "Archive");
            $scope.isSegmentEdited = false;
            $scope.isSegmentSelected = true;
            var segObj = $scope.segmentListData[rowIndx];
            $scope.selectedSegmentId = segObj.segmentId;
            $scope.segment_name = segObj.segmentName;
            $scope.segment_description = segObj.segmentDefination;
            $scope.segementList = segObj.segmentFilter.split("&");
            $scope.selectedSegmentIndx = rowIndx;
            $scope.dataList = [];
        }
    
        $scope.filterSegmentList = function(filterObjList) {
    
            $scope.segmentListFromService = $scope.segmentOriginalListData;
    
            if($scope.segmentListFromService.length <=0) return;
    
            var filterList = new Array();
    
            if(filterObjList.length <= 0){
                filterList =  $scope.segmentListFromService
            }
            
            for(var j=0; j < filterObjList.length; j++){
                var searchData = filterObjList[j].filterVal.toLowerCase();
                filterList = new Array();
                for(var i=0; i < $scope.segmentListFromService.length; i++){
                    var categoryData = "";
                    if(filterObjList[j].segmentName === "segmentState"){
                        categoryData = $scope.segmentListFromService[i].segmentStatus.toLowerCase();
                    }else if(filterObjList[j].segmentName === "CreatedBy"){
                        categoryData = $scope.segmentListFromService[i].user.toLowerCase();
                    }else if(filterObjList[j].segmentName === "Contains"){
                        categoryData = $scope.segmentListFromService[i].segmentFilter.toLowerCase();
                    }else{
                        categoryData = $scope.segmentListFromService[i].segmentName.toLowerCase();
                    }
                    if(categoryData.search(searchData) > -1 ){
                        filterList.push($scope.segmentListFromService[i]);
                    }
                }
    
                $scope.segmentListFromService = filterList;
            }
            
            $scope.isSegmentSelected = false;
            $scope.segment_name = "";
            $scope.segment_description = "";
            $scope.segementList = new Array();
            $scope.segmentListData = filterList;
    
            console.log(filterList);
        }
    
        //$scope.$watch('segment_filter_val', $scope.filterSegmentList);
    
        $scope.navigateView = function(scrIndx) {
            $scope.isSegmentSelected = false;
            $scope.segment_name = "";
            $scope.segment_description = "";
            $scope.segementList = new Array();
    
            if(scrIndx == 1){
                $scope.isFirstScreen = true;
                $scope.load_segments();
            }else if(scrIndx == 2){
                $scope.isFirstScreen = false;
    
                for(var j=0; j < $scope.attributes.length; j++){
                    for(var i=0; i < $scope.attributes[j].attribute_list.length; i++){
                        $scope.attributes[j].attribute_list[i].isAdded = false;
                    }
                }
    
            }
        }
    
        $scope.segment_create = function() {
            $scope.isFirstScreen = false;
            $scope.isSegmentEdited = false;
    
            $scope.segment_name = "";
            $scope.segment_description = "";
            $scope.segementList = new Array();
        }
    
        $scope.segment_edit = function() {
            $scope.isFirstScreen = false;
            $scope.isSegmentEdited = true;
        }
    
        $scope.segment_clone = function() {
            $scope.isFirstScreen = false;
            $scope.isSegmentEdited = false;
            $scope.segment_name = "";
        }
    
        $scope.updateSegmentStatus = function(newStatus) {
            /* var urlVal;
            if(newStatus === "archive"){
                urlVal = SERVICE_PREFIX + UPDATE_SEGMENT_STATUS_SERVICE + "?id=" + $scope.selectedSegmentId + "&segmentstatus=archive";
            }else{
                urlVal = SERVICE_PREFIX + UPDATE_SEGMENT_STATUS_SERVICE + "?id=" + $scope.selectedSegmentId + "&segmentstatus=active";
            }
    
            var updateSegmentService = $http.get(urlVal)
            .success(function(dataFromServer, status, headers, config) {
                $scope.loading = false;
                $scope.load_segments();
            })
            .error(function(dataFromServer, status, headers, config) {
                $scope.loading = false;
            }); */
        }
    
        $scope.buildFilterSegmentList = function(rowIndx, isChk, filterVal) {
    
            filterVal = (filterVal)?filterVal:"";
    
            if(rowIndx == 0){
                if(isChk){
                    $scope.isSegmentStateOption = !$scope.isSegmentStateOption;
                }
                $scope.segmentStateVal = filterVal;
            }else if(rowIndx == 1){
                if(isChk){
                    $scope.isContainsOption = !$scope.isContainsOption;
                }
                $scope.containsVal = filterVal;
            }else if(rowIndx == 2){
                if(isChk){
                    $scope.isCreatedByOption = !$scope.isCreatedByOption;
                }
                $scope.createdByVal = filterVal;
            }else{
                if(isChk){
                    $scope.isSegmentNameOption = !$scope.isSegmentNameOption;
                }
                $scope.segmentNameVal = filterVal;
            }
    
            $scope.segmentFilterObjList = [];
    
            if($scope.isSegmentStateOption){
                $scope.segmentFilterObjList.push({"segmentName":"segmentState", "segmentLabel":"Segment State", "filterVal":$scope.segmentStateVal, "filterLabel":$scope.segmentStateVal})
            }
            if($scope.isContainsOption){
                $scope.segmentFilterObjList.push({"segmentName":"Contains", "segmentLabel":"Contains", "filterVal":$scope.containsVal, "filterLabel":$scope.containsVal})
            }
            if($scope.isCreatedByOption){
                $scope.segmentFilterObjList.push({"segmentName":"CreatedBy", "segmentLabel":"Created By", "filterVal":$scope.createdByVal, "filterLabel":$scope.createdByVal})
            }
            if($scope.isSegmentNameOption){
                $scope.segmentFilterObjList.push({"segmentName":"segmentName", "segmentLabel":"Segment Name", "filterVal":$scope.segmentNameVal, "filterLabel":$scope.segmentNameVal})
            }
    
            var msgArr = [];
    
            for(var i = 0; i < $scope.segmentFilterObjList.length; i++){
                msgArr.push($scope.segmentFilterObjList[i].segmentLabel + " is " + $scope.segmentFilterObjList[i].filterLabel);
            }
    
            if(msgArr.length > 0){
                $scope.segmentFilterVal = "Where " + msgArr.join(" AND ");
            }else{
                $scope.segmentFilterVal = "";
            }
    
            $scope.filterSegmentList($scope.segmentFilterObjList);
        }
    
        $scope.saveSegment = function() {
            /* if (document.getElementById('segment_name').value == "") {
                alert("SegmentName must be filled out");
                return false;
            }
            if (document.getElementById('segment_shortdesc').value == "") {
                alert("SegmentShortDesc must be filled out");
                return false;
            }
    
            $scope.isFirstScreen = true;
            $scope.loading = true; 
    
            if($scope.isSegmentEdited){
                var dataObjectUpdate = {
                    "segmentId":$scope.selectedSegmentId,
                    "segmentName":$scope.segment_name,
                    "segmentDefination":$scope.segment_description,
                    "segmentFilter":$scope.segementList.join("&")
                };
        
                var saveSegmentService = $http.post(SERVICE_PREFIX + UPDATE_SEGMENT_DATA_SERVICE, dataObjectUpdate)
                .success(function(dataFromServer, status, headers, config) {
                    $scope.loading = false;
                    alert(dataFromServer);
                })
                .error(function(data, status, headers, config) {
                    $scope.loading = false;
                });
            }else{
                var dataObjectCreate = {
                    "segmentName":$scope.segment_name,
                    "segmentDefination":$scope.segment_description,
                    "segmentFilter":$scope.segementList.join("&")
                };
        
                var saveSegmentService = $http.post(SERVICE_PREFIX + SAVE_SEGMENT_DEFINATION_SERVICES, dataObjectCreate)
                .success(function(dataFromServer, status, headers, config) {
                    $scope.loading = false;
                    alert(dataFromServer);
                })
                .error(function(data, status, headers, config) {
                    $scope.loading = false;
                });  
            }  */
        }
    
        $scope.updateFilterValue = function(rowIndex, updatedData) {
            $scope.segementList[rowIndex] = updatedData;
        }
    
        $scope.load_attributes = function() {
            //----------------
            var dataFromServer = ATTRIBUTE_LIST_UPDATED;
            $scope.attributeListData = dataFromServer;
            var objAttributesList = [
                {"groupName":"Category_Spend", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Category_Spend},
                {"groupName":"Identifier", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Identifier},
                {"groupName":"Firmographics", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Firmographics},
                {"groupName":"Membership", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Membership}
            ];
            
            $scope.attributes = objAttributesList;
            //----------------

            /* 
            $scope.loading = true;
    
            var attributsService = $http.get(SERVICE_PREFIX + ATTRIBUTE_LIST_SERVICE)
            .success(function(dataFromServer, status, headers, config) {
                $scope.attributeListData = dataFromServer;
                $scope.loading = false;
                var objAttributesList = [
                    {"groupName":"Category_Spend", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Category_Spend},
                    {"groupName":"Identifier", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Identifier},
                    {"groupName":"Firmographics", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Firmographics},
                    {"groupName":"Membership", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Membership}
                ];
                
                $scope.attributes = objAttributesList;
            })
            .error(function(dataFromServer__, status, headers, config) {
                $scope.loading = false;
                var dataFromServer = ATTRIBUTE_LIST_UPDATED;
                $scope.attributeListData = dataFromServer;
                var objAttributesList = [
                    {"groupName":"Category_Spend", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Category_Spend},
                    {"groupName":"Identifier", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Identifier},
                    {"groupName":"Firmographics", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Firmographics},
                    {"groupName":"Membership", "attribute_list":dataFromServer.ACCOUNT_CUSTOMER_BANK.Membership}
                ];
                
                $scope.attributes = objAttributesList;
            }); */
        };
    
        $scope.fetchDetails = function() {
            //-------------
            $scope.dataList = TABLE_LIST; 
            //-------------
            /* 
            $scope.loading = true;        
            var dataObject = $scope.segementList.join("&");
    
            var attributsService = $http.post(SERVICE_PREFIX + FILTERDATA_LIST_SERVICE, dataObject)
            .success(function(dataFromServer, status, headers, config) {
                $scope.loading = false;
                $scope.dataList = dataFromServer;
            })
            .error(function(data, status, headers, config) {
                $scope.loading = false;
                $scope.dataList = TABLE_LIST; 
            }); */
        }
    
        $scope.countAddedAttribute = function(attributeList) {        
            var x = 0;
            for(var i=0; i < attributeList.length; i++){
                if(attributeList[i].isAdded){
                    x++;
                }
            }
            return x;
        }
    
        $scope.load_attributes();
        $scope.load_segments();

    }


    
]);