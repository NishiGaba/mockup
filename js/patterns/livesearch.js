// Pattern which Plone livesearch functionality on an input
//
// Author: Ryan Foster
// Contact: ryan@rynamic.com
// Version: 1.0
//
// Adapted from livesearch.js in Plone.
//
// License:
//
// Copyright (C) 2013 Plone Foundation
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program; if not, write to the Free Software Foundation, Inc., 51
// Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
//

/*jshint bitwise:true, curly:true, eqeqeq:true, immed:true, latedef:true,
  newcap:true, noarg:true, noempty:true, nonew:true, plusplus:true,
  undef:true, strict:true, trailing:true, browser:true, evil:true */
/*global define:false */


define([
  'jquery',
  'js/patterns/base',
  'js/patterns/toggle',
  'underscore',
  'js/patterns/select2',
  'js/patterns/queryhelper'
], function($, Base, Toggle, _, Select2, QueryHelper) {
  "use strict";

  var Livesearch = Base.extend({
    name: "livesearch",
    timeout: null,
    $results: null,
    $input: null,
    $toggle: null,
    cache: {},
    currentTerm: null,
    renderedTerm: '',
    results: '',
    index: null,
    defaults: {
      delay: 200,
      highlight: 'pat-livesearch-highlight', // class to add to items when selected
      minimumInputLength: 3, // number of chars user should type before searching
      toggleTarget: '.pat-livesearch-container', // the element to show/hide when performing search
      toggleClass: 'show',
      resultsTarget: '.pat-livesearch-results', // the element to fill with results
      input: '.pat-livesearch-input', // input selector
      resultContainerTemplate: '<ul></ul>',
      resultContainerTemplateSelector: null,
      dropdownCssClass: 'pat-livesearch-dropdown',
      linkSelector: '.pat-livesearch-result-title',
      itemSelector: '.pat-livesearch-result',
      resultTemplate: '' +
        '<li class="pat-livesearch-result pat-livesearch-type-<%= Type %>">' +
          '<a class="pat-livesearch-result-title" href="<%= getURL %>">' +
            '<%= Title %>' +
          '</a>' +
          '<p class="pat-livesearch-result-desc"><%= Description %></p>' +
        '</li>',
      resultTemplateSelector: null,
      helpTemplate: '<div class="pat-livesearch-help"><%= help %></div>',
      helpTemplateSelector: null,
      typeMoreTemplate: 'Type <%= more %> more characters to search.',
      typeMoreTemplateSelector: null,
      noResultsTemplate: 'No results found.',
      noResultsTemplateSelector: null,
      searchingTemplate: 'Searching...',
      searchingTemplateSelector: null,
      isTest: false
    },

    init: function() {
      var self = this;
      self.query = new QueryHelper(self.$el, self.options);
      self.query.init(self);

      this.$results = $(self.options.resultsTarget, self.$el);

      if (!self.query.valid) {
        $.error('No url provided for livesearch results ' + self.$el);
      }

      if(self.query.valid){
        self.options.ajax = self.query.selectAjax();
      }
      else {
        self.options.tags = [];
      }

      self.$input = $(self.options.input, self.$el);

      if (self.$input.length < 1) {
        $.error('Input element not found ' + self.$el);
      }

      self.$input.on('focus.livesearch.patters', function(e) {
        self.show();
      });

      self.$input.on('blur.livesearch.patters', function(e) {
        self.hide();
      });

      if (self.options.toggleTarget) {
        self.$toggle = $(self.options.toggleTarget, self.$el);
        if (self.$toggle.length) {
          $('html').on('click.livesearch.patterns', function() {
            self.hide();
          });
          self.$toggle.on('click.livesearch.patterns', function(event) {
            event.stopPropagation();
          });
          self.$input.on('click.livesearch.patterns', function(event) {
            event.stopPropagation();
          });
        }

      }

      self.$input.on('keyup keydown', function(event) {
        return self._handler(event);
      });

      // TODO: Figure out why can't these be in one line.
      self.on('showing', function(event) {
        self.render(event);
      });
      self.on('searched', function(event) {
        self.render(event);
      });
      self.on('render', function(event) {
        self.render(event);
      });
      self.on('searching', function(event) {
        self.render(event);
      });
    },

    search: function() {
      var self = this;
      var term = self.currentTerm;
      self.trigger('searching');

      if (self.cache[term]) {
        // already have results, do not load ajax
        self.fillResults(self.cache[term]);
        return;
      }

      var params = self.options.ajax.data(term, 1);

      $.get(
        self.options.ajax.url,
        $.param(params),
        function(data) {
          if(data.results !== undefined){
            self.cache[term] = data.results;
          }else{
            console.log('error from server returning result');
          }
          window.clearInterval(self.timeout);
          self.trigger('searched');
        }
      );
    },

    applyTemplate: function(tpl, item) {
      var self = this;
      var template;
      if (self.options[tpl+'TemplateSelector']) {
        template = $(self.options[tpl+'TemplateSelector']).html();
        if (!template) {
          template = self.options[tpl+'Template'];
        }
      } else {
        template = self.options[tpl+'Template'];
      }
      return _.template(template, item);
    },

    getCache: function() {
      var self = this;
      var data = [];
      if (self.currentTerm !== null && self.currentTerm.length >= self.options.minimumInputLength) {
        if (self.cache[self.currentTerm] !== undefined) {
          data = self.cache[self.currentTerm];
        }
      }
      return data;
    },

    renderHelp: function(tpl, data) {
      var self = this;
      var msg = self.applyTemplate(tpl, data);
      return self.applyTemplate('help', {help: msg});
    },

    render: function(event) {
      var self = this;

      // Don't do anything if we have already rendered for this term
      if (self.currentTerm === self.renderedTerm) {
        return;
      }

      var container = $(self.applyTemplate('resultContainer', self));

      if (event.type === 'searching') {
        container.html(self.renderHelp('searching', {}));
      } else {
        if (self.currentTerm === null || self.currentTerm.length < self.options.minimumInputLength) {
          var chars = self.currentTerm !== null ? self.options.minimumInputLength - self.currentTerm.length : self.options.minimumInputLength;
          container.html(self.renderHelp('typeMore', {more: chars}));
        } else {
          var data = self.getCache();
          if (data.length > 0) {
            $.each(data, function(index, value){
              container.append(self.applyTemplate('result', value));
            });
          } else {
            container.html(self.renderHelp('noResults', {}));
          }
        }
        self.renderedTerm = self.currentTerm;
      }

      self.$results.html(container);
      self.trigger('rendered');
    },

    show: function() {
      var self = this;
      self.trigger('showing');
      if (self.$toggle) {
        self.$toggle.addClass(self.options.toggleClass);
      }
      self.trigger('shown');
    },

    hide: function() {
      var self = this;
      self.trigger('hiding');
      if (self.$toggle) {
        self.$toggle.removeClass(self.options.toggleClass);
      }
      self.trigger('hidden');
    },

    items: function() {
      return this.$results.find(this.options.itemSelector);
    },

    _keyUp: function() {
      var self = this;
      var klass = self.options.highlight;
      var selected = $('.'+klass, self.$results);

      if (selected.length > 0) {
        if (selected.prev().length > 0) {
          selected.removeClass(klass);
          selected = selected.prev().addClass(klass);
        }
      }
    },

    _keyDown: function() {
      var self = this;
      var klass = self.options.highlight;
      var selected = $('.'+klass, self.$results);

      if (selected.length === 0) {
        selected = self.items().first().addClass(klass);
      } else {
        if (selected.next().length > 0) {
          selected.removeClass(klass);
          selected = selected.next().addClass(klass);
        }
      }
    },

    _keyEscape: function() {
      this.hide();
    },

    _keyEnter: function() {
      var self = this;
      var hl = self.options.highlight;
      var target = self.$results.find('.'+hl)
        .find('a').attr('href');
      window.location = target;
    },

    _handler: function(event) {
      var self = this;
      window.clearTimeout(self.timeout);
      if (event.type === 'keyup') {
        switch (event.keyCode) {
          case 13:
            self._keyEnter();
            return false;
          case 27:
            self._keyEscape();
            break;
          case 37: break; // keyLeft
          case 39: break; // keyRight
          default:
            self.currentTerm = self.$input.val();
            if (self.$input.val().length >= self.options.minimumInputLength) {
              self.timeout = window.setInterval(function(){
                try{
                  self.search();
                }catch(e){
                  console.log('error trying to search');
                  window.clearInterval(self.timeout);
                }
              }, self.options.delay);
            } else {
              self.trigger('render');
            }

        }
      } else if (event.type === 'keydown') {
        switch (event.keyCode) {
          case 38:
            self._keyUp();
            return false;
          case 40:
            self._keyDown();
            return false;
        }
      }
    },

    select: function() {
      var self = this;
      var select2 = self.$el.data().select2;
      var dropdown = select2.dropdown;
      var selected = $('.select2-highlighted', dropdown);
      var link = $('.'+self.options.linkSelector, selected);
      var target = link.attr('href');
      if (target) {
        // There may be a better way to do this
        if (self.options.isTest) {
          self.testTarget = target;
        } else {
          window.location = target;
        }
      }
    }

  });

  return Livesearch;

});
