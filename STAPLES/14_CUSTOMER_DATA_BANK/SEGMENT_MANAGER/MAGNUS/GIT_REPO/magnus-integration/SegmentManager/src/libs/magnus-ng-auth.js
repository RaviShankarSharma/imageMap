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