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
