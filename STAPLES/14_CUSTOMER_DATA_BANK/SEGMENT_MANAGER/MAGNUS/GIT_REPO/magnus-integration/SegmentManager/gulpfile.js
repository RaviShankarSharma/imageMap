// Include gulp
var gulp = require('gulp');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var ngAnnotate = require('gulp-ng-annotate');
var minifyCss = require('gulp-minify-css');
var htmlmin = require('gulp-htmlmin');
var clean = require('gulp-clean');
var replace = require('gulp-replace');
var templateCache = require('gulp-angular-templatecache');
var runSequence = require('run-sequence');
var exec = require('child_process').exec;
var config = require('./gulpconfig.json');

// Clean
gulp.task('clean', function () {
    return gulp.src(config.releasePath.root, { read: false }).pipe(clean());
});

gulp.task('lint', function() {
    return gulp.src(config.files.jsfiles)
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

gulp.task('vendor', function() {
    return gulp.src(config.files.vendorJsFiles)
        .pipe(concat(config.fileName.vendorJs))
        .pipe(gulp.dest(config.releasePath.js));
});

gulp.task('scripts', function() {
    return gulp.src(config.files.jsfiles)
        .pipe(concat(config.fileName.js))
        .pipe(ngAnnotate())
        .pipe(gulp.dest(config.releasePath.js))
        .pipe(uglify())
        .pipe(rename(config.fileName.jsMin))
        .pipe(gulp.dest(config.releasePath.js))
        .on('error', gutil.log);
});

gulp.task('images', function() {
    return gulp.src(config.sources.image)
        .pipe(gulp.dest(config.releasePath.root))
        .on('error', gutil.log);
});

gulp.task('html', function() {
    return gulp.src(config.sources.html)
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest(config.releasePath.root))
        .on('error', gutil.log);
});

gulp.task('json', function() {
    return gulp.src(config.sources.json)
        .pipe(gulp.dest(config.releasePath.root))
        .on('error', gutil.log);
});

// Fonts
gulp.task('fonts', function() {
    return gulp.src(config.sources.font)
        .pipe(gulp.dest(config.releasePath.root))
        .on('error', gutil.log);
});

// componentFonts
gulp.task('componentFonts', function() {
    return gulp.src(config.sources.componentFonts)
        .pipe(gulp.dest(config.releasePath.css))
        .on('error', gutil.log);
});

gulp.task('minify-css', function() {
    return gulp.src(config.files.cssfiles)
        .pipe(replace(config.replacer.bootstrapFont.old, config.replacer.bootstrapFont.new))
        .pipe(concat(config.fileName.css))
        .pipe(gulp.dest(config.releasePath.css))
        .pipe(minifyCss({compatibility: 'ie8'}))
        .pipe(rename(config.fileName.cssMin))
        .pipe(gulp.dest(config.releasePath.css))
        .on('error', gutil.log);
});

gulp.task('template', function () {
    return gulp.src(config.files.templateFiles)
        .pipe(templateCache())
        .pipe(gulp.dest(config.releasePath.js));
});

gulp.task('copy', function() {
    //return gulp.src(config.releasePath.root+'/**/*.*')
    //           .pipe(gulp.dest(config.webappPath));
});

gulp.task('watchCss', function(){
    runSequence('minify-css','copy');
});
gulp.task('watchJs', function(){
    runSequence('scripts','copy');
});
gulp.task('watchHtml', function(){
    runSequence('html','copy');
});
gulp.task('watchTemplate', function () {
    runSequence('template', 'copy');
});
gulp.task('watchJson', function(){
    runSequence('json','copy');
});

gulp.task('serve', function () {
    exec('node server.js', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
    });
});

gulp.task('watchFiles', function () {
    gulp.watch(config.files.cssfiles, ['watchCss']);
    gulp.watch(config.files.jsfiles, ['watchJs']);
    gulp.watch(config.sources.html, ['watchHtml']);
    gulp.watch(config.files.templateFiles, ['watchTemplate']);
    gulp.watch(config.sources.json, ['watchJson']);
});

gulp.task('watch', ['default'], function() {
    runSequence('watchFiles');
});

var allTasks = ['vendor', 'scripts', 'html', 'template', 'minify-css', 'fonts', 'componentFonts', 'images', 'json'];

gulp.task('default', function () {
    runSequence('clean', 'lint', allTasks, 'copy');
});

gulp.task('dev', function () {
    runSequence('serve', 'watchFiles');
});
