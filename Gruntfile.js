module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    typescript: {
      client: {
        src: ['gnd.ts'],
        dest: 'dist/gnd.js',
        options: {
          module: 'amd', //or commonjs
          target: 'es3', //or es5
          //base_path: 'path/to/typescript/files',
          sourcemap: true,
          fullSourceMapPath: true,
          //declaration: true,
        }
      },
      server: {
        src: ['gnd-server.ts'],
        dest: 'dist/gnd-server.js',
        options: {
          module: 'amd', //or commonjs
          target: 'es3', //or es5
          //base_path: 'path/to/typescript/files',
          sourcemap: true,
          fullSourceMapPath: true,
          //declaration: true,
        }
      }
    },
    uglify: {
      client: {
        files: {'dist/gnd.min.js': ['dist/gnd.js']},
        options: {
          banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
          compress: {
            warnings: false,
            unsafe: true,
          },
          mangle: true, 
          warnings: false
          // report: 'gzip',
        }
      }
    },
    compress: {
      main: {
        options: {
          mode: 'gzip',
          level: 9
        },
        expand: true,
        //cwd: 'assets/',
        src: ['dist/gnd.min.js'],
        dest: 'dist/'
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-typescript');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-compress');

  // Default task(s).
  grunt.registerTask('default', ['typescript', 'uglify', 'compress']);
};