(function () {
  'use strict';

  function mergeConfigs(...configObjects) {
    function flattenObject(configObject) {
      const flattenedObject = {};
      function flattenLoop(obj, prefix) {
        for (const [key, value] of Object.entries(obj)) {
          const prefixedKey = prefix ? `${prefix}.${key}` : key;
          if (value && typeof value === 'object') {
            flattenLoop(value, prefixedKey);
          } else {
            flattenedObject[prefixedKey] = value;
          }
        }
      }
      flattenLoop(configObject);
      return flattenedObject;
    }
    const formattedConfigObject = {};
    for (const configObject of configObjects) {
      const obj = flattenObject(configObject);
      for (const [key, value] of Object.entries(obj)) {
        formattedConfigObject[key] = value;
      }
    }
    return formattedConfigObject;
  }
  function extractConfigByNamespace(configObject, namespace) {
    const newObject = {};
    for (const [key, value] of Object.entries(configObject)) {
      const keyParts = key.split('.');
      if (keyParts[0] === namespace) {
        if (keyParts.length > 1) {
          keyParts.shift();
        }
        const newKey = keyParts.join('.');
        newObject[newKey] = value;
      }
    }
    return newObject;
  }
  function getFragmentFromUrl(url) {
    if (!url.includes('#')) {
      return undefined;
    }
    return url.split('#').pop();
  }
  function getBreakpoint(name) {
    const property = `--govuk-frontend-breakpoint-${name}`;
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(property);
    return {
      property,
      value: value || undefined
    };
  }
  function setFocus($element, options = {}) {
    var _options$onBeforeFocu;
    const isFocusable = $element.getAttribute('tabindex');
    if (!isFocusable) {
      $element.setAttribute('tabindex', '-1');
    }
    function onFocus() {
      $element.addEventListener('blur', onBlur, {
        once: true
      });
    }
    function onBlur() {
      var _options$onBlur;
      (_options$onBlur = options.onBlur) == null || _options$onBlur.call($element);
      if (!isFocusable) {
        $element.removeAttribute('tabindex');
      }
    }
    $element.addEventListener('focus', onFocus, {
      once: true
    });
    (_options$onBeforeFocu = options.onBeforeFocus) == null || _options$onBeforeFocu.call($element);
    $element.focus();
  }
  function isSupported($scope = document.body) {
    if (!$scope) {
      return false;
    }
    return $scope.classList.contains('govuk-frontend-supported');
  }
  function validateConfig(schema, config) {
    const validationErrors = [];
    for (const [name, conditions] of Object.entries(schema)) {
      const errors = [];
      for (const {
        required,
        errorMessage
      } of conditions) {
        if (!required.every(key => !!config[key])) {
          errors.push(errorMessage);
        }
      }
      if (name === 'anyOf' && !(conditions.length - errors.length >= 1)) {
        validationErrors.push(...errors);
      }
    }
    return validationErrors;
  }

  function normaliseString(value) {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmedValue = value.trim();
    if (trimmedValue === 'true') {
      return true;
    }
    if (trimmedValue === 'false') {
      return false;
    }
    if (trimmedValue.length > 0 && isFinite(Number(trimmedValue))) {
      return Number(trimmedValue);
    }
    return value;
  }
  function normaliseDataset(dataset) {
    const out = {};
    for (const [key, value] of Object.entries(dataset)) {
      out[key] = normaliseString(value);
    }
    return out;
  }

  class GOVUKFrontendError extends Error {
    constructor(...args) {
      super(...args);
      this.name = 'GOVUKFrontendError';
    }
  }
  class SupportError extends GOVUKFrontendError {
    /**
     * Checks if GOV.UK Frontend is supported on this page
     *
     * @param {HTMLElement | null} [$scope] - HTML element `<body>` checked for browser support
     */
    constructor($scope = document.body) {
      const supportMessage = 'noModule' in HTMLScriptElement.prototype ? 'GOV.UK Frontend initialised without `<body class="govuk-frontend-supported">` from template `<script>` snippet' : 'GOV.UK Frontend is not supported in this browser';
      super($scope ? supportMessage : 'GOV.UK Frontend initialised without `<script type="module">`');
      this.name = 'SupportError';
    }
  }
  class ConfigError extends GOVUKFrontendError {
    constructor(...args) {
      super(...args);
      this.name = 'ConfigError';
    }
  }
  class ElementError extends GOVUKFrontendError {
    constructor(messageOrOptions) {
      let message = typeof messageOrOptions === 'string' ? messageOrOptions : '';
      if (typeof messageOrOptions === 'object') {
        const {
          componentName,
          identifier,
          element,
          expectedType
        } = messageOrOptions;
        message = `${componentName}: ${identifier}`;
        message += element ? ` is not of type ${expectedType != null ? expectedType : 'HTMLElement'}` : ' not found';
      }
      super(message);
      this.name = 'ElementError';
    }
  }

  class GOVUKFrontendComponent {
    constructor() {
      this.checkSupport();
    }
    checkSupport() {
      if (!isSupported()) {
        throw new SupportError();
      }
    }
  }

  class I18n {
    constructor(translations = {}, config = {}) {
      var _config$locale;
      this.translations = void 0;
      this.locale = void 0;
      this.translations = translations;
      this.locale = (_config$locale = config.locale) != null ? _config$locale : document.documentElement.lang || 'en';
    }
    t(lookupKey, options) {
      if (!lookupKey) {
        throw new Error('i18n: lookup key missing');
      }
      if (typeof (options == null ? void 0 : options.count) === 'number') {
        lookupKey = `${lookupKey}.${this.getPluralSuffix(lookupKey, options.count)}`;
      }
      const translationString = this.translations[lookupKey];
      if (typeof translationString === 'string') {
        if (translationString.match(/%{(.\S+)}/)) {
          if (!options) {
            throw new Error('i18n: cannot replace placeholders in string if no option data provided');
          }
          return this.replacePlaceholders(translationString, options);
        }
        return translationString;
      }
      return lookupKey;
    }
    replacePlaceholders(translationString, options) {
      const formatter = Intl.NumberFormat.supportedLocalesOf(this.locale).length ? new Intl.NumberFormat(this.locale) : undefined;
      return translationString.replace(/%{(.\S+)}/g, function (placeholderWithBraces, placeholderKey) {
        if (Object.prototype.hasOwnProperty.call(options, placeholderKey)) {
          const placeholderValue = options[placeholderKey];
          if (placeholderValue === false || typeof placeholderValue !== 'number' && typeof placeholderValue !== 'string') {
            return '';
          }
          if (typeof placeholderValue === 'number') {
            return formatter ? formatter.format(placeholderValue) : `${placeholderValue}`;
          }
          return placeholderValue;
        }
        throw new Error(`i18n: no data found to replace ${placeholderWithBraces} placeholder in string`);
      });
    }
    hasIntlPluralRulesSupport() {
      return Boolean('PluralRules' in window.Intl && Intl.PluralRules.supportedLocalesOf(this.locale).length);
    }
    getPluralSuffix(lookupKey, count) {
      count = Number(count);
      if (!isFinite(count)) {
        return 'other';
      }
      const preferredForm = this.hasIntlPluralRulesSupport() ? new Intl.PluralRules(this.locale).select(count) : this.selectPluralFormUsingFallbackRules(count);
      if (`${lookupKey}.${preferredForm}` in this.translations) {
        return preferredForm;
      } else if (`${lookupKey}.other` in this.translations) {
        console.warn(`i18n: Missing plural form ".${preferredForm}" for "${this.locale}" locale. Falling back to ".other".`);
        return 'other';
      }
      throw new Error(`i18n: Plural form ".other" is required for "${this.locale}" locale`);
    }
    selectPluralFormUsingFallbackRules(count) {
      count = Math.abs(Math.floor(count));
      const ruleset = this.getPluralRulesForLocale();
      if (ruleset) {
        return I18n.pluralRules[ruleset](count);
      }
      return 'other';
    }
    getPluralRulesForLocale() {
      const localeShort = this.locale.split('-')[0];
      for (const pluralRule in I18n.pluralRulesMap) {
        const languages = I18n.pluralRulesMap[pluralRule];
        if (languages.includes(this.locale) || languages.includes(localeShort)) {
          return pluralRule;
        }
      }
    }
  }
  I18n.pluralRulesMap = {
    arabic: ['ar'],
    chinese: ['my', 'zh', 'id', 'ja', 'jv', 'ko', 'ms', 'th', 'vi'],
    french: ['hy', 'bn', 'fr', 'gu', 'hi', 'fa', 'pa', 'zu'],
    german: ['af', 'sq', 'az', 'eu', 'bg', 'ca', 'da', 'nl', 'en', 'et', 'fi', 'ka', 'de', 'el', 'hu', 'lb', 'no', 'so', 'sw', 'sv', 'ta', 'te', 'tr', 'ur'],
    irish: ['ga'],
    russian: ['ru', 'uk'],
    scottish: ['gd'],
    spanish: ['pt-PT', 'it', 'es'],
    welsh: ['cy']
  };
  I18n.pluralRules = {
    arabic(n) {
      if (n === 0) {
        return 'zero';
      }
      if (n === 1) {
        return 'one';
      }
      if (n === 2) {
        return 'two';
      }
      if (n % 100 >= 3 && n % 100 <= 10) {
        return 'few';
      }
      if (n % 100 >= 11 && n % 100 <= 99) {
        return 'many';
      }
      return 'other';
    },
    chinese() {
      return 'other';
    },
    french(n) {
      return n === 0 || n === 1 ? 'one' : 'other';
    },
    german(n) {
      return n === 1 ? 'one' : 'other';
    },
    irish(n) {
      if (n === 1) {
        return 'one';
      }
      if (n === 2) {
        return 'two';
      }
      if (n >= 3 && n <= 6) {
        return 'few';
      }
      if (n >= 7 && n <= 10) {
        return 'many';
      }
      return 'other';
    },
    russian(n) {
      const lastTwo = n % 100;
      const last = lastTwo % 10;
      if (last === 1 && lastTwo !== 11) {
        return 'one';
      }
      if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
        return 'few';
      }
      if (last === 0 || last >= 5 && last <= 9 || lastTwo >= 11 && lastTwo <= 14) {
        return 'many';
      }
      return 'other';
    },
    scottish(n) {
      if (n === 1 || n === 11) {
        return 'one';
      }
      if (n === 2 || n === 12) {
        return 'two';
      }
      if (n >= 3 && n <= 10 || n >= 13 && n <= 19) {
        return 'few';
      }
      return 'other';
    },
    spanish(n) {
      if (n === 1) {
        return 'one';
      }
      if (n % 1000000 === 0 && n !== 0) {
        return 'many';
      }
      return 'other';
    },
    welsh(n) {
      if (n === 0) {
        return 'zero';
      }
      if (n === 1) {
        return 'one';
      }
      if (n === 2) {
        return 'two';
      }
      if (n === 3) {
        return 'few';
      }
      if (n === 6) {
        return 'many';
      }
      return 'other';
    }
  };

  /**
   * Accordion component
   *
   * This allows a collection of sections to be collapsed by default, showing only
   * their headers. Sections can be expanded or collapsed individually by clicking
   * their headers. A "Show all sections" button is also added to the top of the
   * accordion, which switches to "Hide all sections" when all the sections are
   * expanded.
   *
   * The state of each section is saved to the DOM via the `aria-expanded`
   * attribute, which also provides accessibility.
   *
   * @preserve
   */
  class Accordion extends GOVUKFrontendComponent {
    /**
     * @param {Element | null} $module - HTML element to use for accordion
     * @param {AccordionConfig} [config] - Accordion config
     */
    constructor($module, config = {}) {
      super();
      this.$module = void 0;
      this.config = void 0;
      this.i18n = void 0;
      this.controlsClass = 'govuk-accordion__controls';
      this.showAllClass = 'govuk-accordion__show-all';
      this.showAllTextClass = 'govuk-accordion__show-all-text';
      this.sectionClass = 'govuk-accordion__section';
      this.sectionExpandedClass = 'govuk-accordion__section--expanded';
      this.sectionButtonClass = 'govuk-accordion__section-button';
      this.sectionHeaderClass = 'govuk-accordion__section-header';
      this.sectionHeadingClass = 'govuk-accordion__section-heading';
      this.sectionHeadingDividerClass = 'govuk-accordion__section-heading-divider';
      this.sectionHeadingTextClass = 'govuk-accordion__section-heading-text';
      this.sectionHeadingTextFocusClass = 'govuk-accordion__section-heading-text-focus';
      this.sectionShowHideToggleClass = 'govuk-accordion__section-toggle';
      this.sectionShowHideToggleFocusClass = 'govuk-accordion__section-toggle-focus';
      this.sectionShowHideTextClass = 'govuk-accordion__section-toggle-text';
      this.upChevronIconClass = 'govuk-accordion-nav__chevron';
      this.downChevronIconClass = 'govuk-accordion-nav__chevron--down';
      this.sectionSummaryClass = 'govuk-accordion__section-summary';
      this.sectionSummaryFocusClass = 'govuk-accordion__section-summary-focus';
      this.sectionContentClass = 'govuk-accordion__section-content';
      this.$sections = void 0;
      this.browserSupportsSessionStorage = false;
      this.$showAllButton = null;
      this.$showAllIcon = null;
      this.$showAllText = null;
      if (!($module instanceof HTMLElement)) {
        throw new ElementError({
          componentName: 'Accordion',
          element: $module,
          identifier: 'Root element (`$module`)'
        });
      }
      this.$module = $module;
      this.config = mergeConfigs(Accordion.defaults, config, normaliseDataset($module.dataset));
      this.i18n = new I18n(extractConfigByNamespace(this.config, 'i18n'));
      const $sections = this.$module.querySelectorAll(`.${this.sectionClass}`);
      if (!$sections.length) {
        throw new ElementError({
          componentName: 'Accordion',
          identifier: `Sections (\`<div class="${this.sectionClass}">\`)`
        });
      }
      this.$sections = $sections;
      this.browserSupportsSessionStorage = helper.checkForSessionStorage();
      this.initControls();
      this.initSectionHeaders();
      const areAllSectionsOpen = this.checkIfAllSectionsOpen();
      this.updateShowAllButton(areAllSectionsOpen);
    }
    initControls() {
      this.$showAllButton = document.createElement('button');
      this.$showAllButton.setAttribute('type', 'button');
      this.$showAllButton.setAttribute('class', this.showAllClass);
      this.$showAllButton.setAttribute('aria-expanded', 'false');
      this.$showAllIcon = document.createElement('span');
      this.$showAllIcon.classList.add(this.upChevronIconClass);
      this.$showAllButton.appendChild(this.$showAllIcon);
      const $accordionControls = document.createElement('div');
      $accordionControls.setAttribute('class', this.controlsClass);
      $accordionControls.appendChild(this.$showAllButton);
      this.$module.insertBefore($accordionControls, this.$module.firstChild);
      this.$showAllText = document.createElement('span');
      this.$showAllText.classList.add(this.showAllTextClass);
      this.$showAllButton.appendChild(this.$showAllText);
      this.$showAllButton.addEventListener('click', () => this.onShowOrHideAllToggle());
      if ('onbeforematch' in document) {
        document.addEventListener('beforematch', event => this.onBeforeMatch(event));
      }
    }
    initSectionHeaders() {
      this.$sections.forEach(($section, i) => {
        const $header = $section.querySelector(`.${this.sectionHeaderClass}`);
        if (!$header) {
          throw new ElementError({
            componentName: 'Accordion',
            identifier: `Section headers (\`<div class="${this.sectionHeaderClass}">\`)`
          });
        }
        this.constructHeaderMarkup($header, i);
        this.setExpanded(this.isExpanded($section), $section);
        $header.addEventListener('click', () => this.onSectionToggle($section));
        this.setInitialState($section);
      });
    }
    constructHeaderMarkup($header, index) {
      const $span = $header.querySelector(`.${this.sectionButtonClass}`);
      const $heading = $header.querySelector(`.${this.sectionHeadingClass}`);
      const $summary = $header.querySelector(`.${this.sectionSummaryClass}`);
      if (!$heading) {
        throw new ElementError({
          componentName: 'Accordion',
          identifier: `Section heading (\`.${this.sectionHeadingClass}\`)`
        });
      }
      if (!$span) {
        throw new ElementError({
          componentName: 'Accordion',
          identifier: `Section button placeholder (\`<span class="${this.sectionButtonClass}">\`)`
        });
      }
      const $button = document.createElement('button');
      $button.setAttribute('type', 'button');
      $button.setAttribute('aria-controls', `${this.$module.id}-content-${index + 1}`);
      for (const attr of Array.from($span.attributes)) {
        if (attr.nodeName !== 'id') {
          $button.setAttribute(attr.nodeName, `${attr.nodeValue}`);
        }
      }
      const $headingText = document.createElement('span');
      $headingText.classList.add(this.sectionHeadingTextClass);
      $headingText.id = $span.id;
      const $headingTextFocus = document.createElement('span');
      $headingTextFocus.classList.add(this.sectionHeadingTextFocusClass);
      $headingText.appendChild($headingTextFocus);
      $headingTextFocus.innerHTML = $span.innerHTML;
      const $showHideToggle = document.createElement('span');
      $showHideToggle.classList.add(this.sectionShowHideToggleClass);
      $showHideToggle.setAttribute('data-nosnippet', '');
      const $showHideToggleFocus = document.createElement('span');
      $showHideToggleFocus.classList.add(this.sectionShowHideToggleFocusClass);
      $showHideToggle.appendChild($showHideToggleFocus);
      const $showHideText = document.createElement('span');
      const $showHideIcon = document.createElement('span');
      $showHideIcon.classList.add(this.upChevronIconClass);
      $showHideToggleFocus.appendChild($showHideIcon);
      $showHideText.classList.add(this.sectionShowHideTextClass);
      $showHideToggleFocus.appendChild($showHideText);
      $button.appendChild($headingText);
      $button.appendChild(this.getButtonPunctuationEl());
      if ($summary != null && $summary.parentNode) {
        const $summarySpan = document.createElement('span');
        const $summarySpanFocus = document.createElement('span');
        $summarySpanFocus.classList.add(this.sectionSummaryFocusClass);
        $summarySpan.appendChild($summarySpanFocus);
        for (const attr of Array.from($summary.attributes)) {
          $summarySpan.setAttribute(attr.nodeName, `${attr.nodeValue}`);
        }
        $summarySpanFocus.innerHTML = $summary.innerHTML;
        $summary.parentNode.replaceChild($summarySpan, $summary);
        $button.appendChild($summarySpan);
        $button.appendChild(this.getButtonPunctuationEl());
      }
      $button.appendChild($showHideToggle);
      $heading.removeChild($span);
      $heading.appendChild($button);
    }
    onBeforeMatch(event) {
      const $fragment = event.target;
      if (!($fragment instanceof Element)) {
        return;
      }
      const $section = $fragment.closest(`.${this.sectionClass}`);
      if ($section) {
        this.setExpanded(true, $section);
      }
    }
    onSectionToggle($section) {
      const expanded = this.isExpanded($section);
      this.setExpanded(!expanded, $section);
      this.storeState($section);
    }
    onShowOrHideAllToggle() {
      const nowExpanded = !this.checkIfAllSectionsOpen();
      this.$sections.forEach($section => {
        this.setExpanded(nowExpanded, $section);
        this.storeState($section);
      });
      this.updateShowAllButton(nowExpanded);
    }
    setExpanded(expanded, $section) {
      const $showHideIcon = $section.querySelector(`.${this.upChevronIconClass}`);
      const $showHideText = $section.querySelector(`.${this.sectionShowHideTextClass}`);
      const $button = $section.querySelector(`.${this.sectionButtonClass}`);
      const $content = $section.querySelector(`.${this.sectionContentClass}`);
      if (!$content) {
        throw new ElementError({
          componentName: 'Accordion',
          identifier: `Section content (\`<div class="${this.sectionContentClass}">\`)`
        });
      }
      if (!$showHideIcon || !$showHideText || !$button) {
        return;
      }
      const newButtonText = expanded ? this.i18n.t('hideSection') : this.i18n.t('showSection');
      $showHideText.textContent = newButtonText;
      $button.setAttribute('aria-expanded', `${expanded}`);
      const ariaLabelParts = [];
      const $headingText = $section.querySelector(`.${this.sectionHeadingTextClass}`);
      if ($headingText) {
        ariaLabelParts.push(`${$headingText.textContent}`.trim());
      }
      const $summary = $section.querySelector(`.${this.sectionSummaryClass}`);
      if ($summary) {
        ariaLabelParts.push(`${$summary.textContent}`.trim());
      }
      const ariaLabelMessage = expanded ? this.i18n.t('hideSectionAriaLabel') : this.i18n.t('showSectionAriaLabel');
      ariaLabelParts.push(ariaLabelMessage);
      $button.setAttribute('aria-label', ariaLabelParts.join(' , '));
      if (expanded) {
        $content.removeAttribute('hidden');
        $section.classList.add(this.sectionExpandedClass);
        $showHideIcon.classList.remove(this.downChevronIconClass);
      } else {
        $content.setAttribute('hidden', 'until-found');
        $section.classList.remove(this.sectionExpandedClass);
        $showHideIcon.classList.add(this.downChevronIconClass);
      }
      const areAllSectionsOpen = this.checkIfAllSectionsOpen();
      this.updateShowAllButton(areAllSectionsOpen);
    }
    isExpanded($section) {
      return $section.classList.contains(this.sectionExpandedClass);
    }
    checkIfAllSectionsOpen() {
      const sectionsCount = this.$sections.length;
      const expandedSectionCount = this.$module.querySelectorAll(`.${this.sectionExpandedClass}`).length;
      const areAllSectionsOpen = sectionsCount === expandedSectionCount;
      return areAllSectionsOpen;
    }
    updateShowAllButton(expanded) {
      if (!this.$showAllButton || !this.$showAllText || !this.$showAllIcon) {
        return;
      }
      this.$showAllButton.setAttribute('aria-expanded', expanded.toString());
      this.$showAllText.textContent = expanded ? this.i18n.t('hideAllSections') : this.i18n.t('showAllSections');
      this.$showAllIcon.classList.toggle(this.downChevronIconClass, !expanded);
    }
    storeState($section) {
      if (this.browserSupportsSessionStorage && this.config.rememberExpanded) {
        const $button = $section.querySelector(`.${this.sectionButtonClass}`);
        if ($button) {
          const contentId = $button.getAttribute('aria-controls');
          const contentState = $button.getAttribute('aria-expanded');
          if (contentId && contentState) {
            window.sessionStorage.setItem(contentId, contentState);
          }
        }
      }
    }
    setInitialState($section) {
      if (this.browserSupportsSessionStorage && this.config.rememberExpanded) {
        const $button = $section.querySelector(`.${this.sectionButtonClass}`);
        if ($button) {
          const contentId = $button.getAttribute('aria-controls');
          const contentState = contentId ? window.sessionStorage.getItem(contentId) : null;
          if (contentState !== null) {
            this.setExpanded(contentState === 'true', $section);
          }
        }
      }
    }
    getButtonPunctuationEl() {
      const $punctuationEl = document.createElement('span');
      $punctuationEl.classList.add('govuk-visually-hidden', this.sectionHeadingDividerClass);
      $punctuationEl.innerHTML = ', ';
      return $punctuationEl;
    }
  }
  Accordion.moduleName = 'govuk-accordion';
  Accordion.defaults = Object.freeze({
    i18n: {
      hideAllSections: 'Hide all sections',
      hideSection: 'Hide',
      hideSectionAriaLabel: 'Hide this section',
      showAllSections: 'Show all sections',
      showSection: 'Show',
      showSectionAriaLabel: 'Show this section'
    },
    rememberExpanded: true
  });
  const helper = {
    /**
     * Check for `window.sessionStorage`, and that it actually works.
     *
     * @returns {boolean} True if session storage is available
     */
    checkForSessionStorage: function () {
      const testString = 'this is the test string';
      let result;
      try {
        window.sessionStorage.setItem(testString, testString);
        result = window.sessionStorage.getItem(testString) === testString.toString();
        window.sessionStorage.removeItem(testString);
        return result;
      } catch (exception) {
        return false;
      }
    }
  };

  const KEY_SPACE = 32;
  const DEBOUNCE_TIMEOUT_IN_SECONDS = 1;

  /**
   * JavaScript enhancements for the Button component
   *
   * @preserve
   */
  class Button extends GOVUKFrontendComponent {
    /**
     * @param {Element | null} $module - HTML element to use for button
     * @param {ButtonConfig} [config] - Button config
     */
    constructor($module, config = {}) {
      super();
      this.$module = void 0;
      this.config = void 0;
      this.debounceFormSubmitTimer = null;
      if (!($module instanceof HTMLElement)) {
        throw new ElementError({
          componentName: 'Button',
          element: $module,
          identifier: 'Root element (`$module`)'
        });
      }
      this.$module = $module;
      this.config = mergeConfigs(Button.defaults, config, normaliseDataset($module.dataset));
      this.$module.addEventListener('keydown', event => this.handleKeyDown(event));
      this.$module.addEventListener('click', event => this.debounce(event));
    }
    handleKeyDown(event) {
      const $target = event.target;
      if (event.keyCode !== KEY_SPACE) {
        return;
      }
      if ($target instanceof HTMLElement && $target.getAttribute('role') === 'button') {
        event.preventDefault();
        $target.click();
      }
    }
    debounce(event) {
      if (!this.config.preventDoubleClick) {
        return;
      }
      if (this.debounceFormSubmitTimer) {
        event.preventDefault();
        return false;
      }
      this.debounceFormSubmitTimer = window.setTimeout(() => {
        this.debounceFormSubmitTimer = null;
      }, DEBOUNCE_TIMEOUT_IN_SECONDS * 1000);
    }
  }

  /**
   * Button config
   *
   * @typedef {object} ButtonConfig
   * @property {boolean} [preventDoubleClick=false] - Prevent accidental double
   *   clicks on submit buttons from submitting forms multiple times.
   */
  Button.moduleName = 'govuk-button';
  Button.defaults = Object.freeze({
    preventDoubleClick: false
  });

  function closestAttributeValue($element, attributeName) {
    const $closestElementWithAttribute = $element.closest(`[${attributeName}]`);
    return $closestElementWithAttribute ? $closestElementWithAttribute.getAttribute(attributeName) : null;
  }

  /**
   * Character count component
   *
   * Tracks the number of characters or words in the `.govuk-js-character-count`
   * `<textarea>` inside the element. Displays a message with the remaining number
   * of characters/words available, or the number of characters/words in excess.
   *
   * You can configure the message to only appear after a certain percentage
   * of the available characters/words has been entered.
   *
   * @preserve
   */
  class CharacterCount extends GOVUKFrontendComponent {
    /**
     * @param {Element | null} $module - HTML element to use for character count
     * @param {CharacterCountConfig} [config] - Character count config
     */
    constructor($module, config = {}) {
      var _ref, _this$config$maxwords;
      super();
      this.$module = void 0;
      this.$textarea = void 0;
      this.$visibleCountMessage = void 0;
      this.$screenReaderCountMessage = void 0;
      this.lastInputTimestamp = null;
      this.lastInputValue = '';
      this.valueChecker = null;
      this.config = void 0;
      this.i18n = void 0;
      this.maxLength = void 0;
      if (!($module instanceof HTMLElement)) {
        throw new ElementError({
          componentName: 'Character count',
          element: $module,
          identifier: 'Root element (`$module`)'
        });
      }
      const $textarea = $module.querySelector('.govuk-js-character-count');
      if (!($textarea instanceof HTMLTextAreaElement || $textarea instanceof HTMLInputElement)) {
        throw new ElementError({
          componentName: 'Character count',
          element: $textarea,
          expectedType: 'HTMLTextareaElement or HTMLInputElement',
          identifier: 'Form field (`.govuk-js-character-count`)'
        });
      }
      const datasetConfig = normaliseDataset($module.dataset);
      let configOverrides = {};
      if ('maxwords' in datasetConfig || 'maxlength' in datasetConfig) {
        configOverrides = {
          maxlength: undefined,
          maxwords: undefined
        };
      }
      this.config = mergeConfigs(CharacterCount.defaults, config, configOverrides, datasetConfig);
      const errors = validateConfig(CharacterCount.schema, this.config);
      if (errors[0]) {
        throw new ConfigError(`Character count: ${errors[0]}`);
      }
      this.i18n = new I18n(extractConfigByNamespace(this.config, 'i18n'), {
        locale: closestAttributeValue($module, 'lang')
      });
      this.maxLength = (_ref = (_this$config$maxwords = this.config.maxwords) != null ? _this$config$maxwords : this.config.maxlength) != null ? _ref : Infinity;
      this.$module = $module;
      this.$textarea = $textarea;
      const textareaDescriptionId = `${this.$textarea.id}-info`;
      const $textareaDescription = document.getElementById(textareaDescriptionId);
      if (!$textareaDescription) {
        throw new ElementError({
          componentName: 'Character count',
          element: $textareaDescription,
          identifier: `Count message (\`id="${textareaDescriptionId}"\`)`
        });
      }
      if (`${$textareaDescription.textContent}`.match(/^\s*$/)) {
        $textareaDescription.textContent = this.i18n.t('textareaDescription', {
          count: this.maxLength
        });
      }
      this.$textarea.insertAdjacentElement('afterend', $textareaDescription);
      const $screenReaderCountMessage = document.createElement('div');
      $screenReaderCountMessage.className = 'govuk-character-count__sr-status govuk-visually-hidden';
      $screenReaderCountMessage.setAttribute('aria-live', 'polite');
      this.$screenReaderCountMessage = $screenReaderCountMessage;
      $textareaDescription.insertAdjacentElement('afterend', $screenReaderCountMessage);
      const $visibleCountMessage = document.createElement('div');
      $visibleCountMessage.className = $textareaDescription.className;
      $visibleCountMessage.classList.add('govuk-character-count__status');
      $visibleCountMessage.setAttribute('aria-hidden', 'true');
      this.$visibleCountMessage = $visibleCountMessage;
      $textareaDescription.insertAdjacentElement('afterend', $visibleCountMessage);
      $textareaDescription.classList.add('govuk-visually-hidden');
      this.$textarea.removeAttribute('maxlength');
      this.bindChangeEvents();
      window.addEventListener('pageshow', () => this.updateCountMessage());
      this.updateCountMessage();
    }
    bindChangeEvents() {
      this.$textarea.addEventListener('keyup', () => this.handleKeyUp());
      this.$textarea.addEventListener('focus', () => this.handleFocus());
      this.$textarea.addEventListener('blur', () => this.handleBlur());
    }
    handleKeyUp() {
      this.updateVisibleCountMessage();
      this.lastInputTimestamp = Date.now();
    }
    handleFocus() {
      this.valueChecker = window.setInterval(() => {
        if (!this.lastInputTimestamp || Date.now() - 500 >= this.lastInputTimestamp) {
          this.updateIfValueChanged();
        }
      }, 1000);
    }
    handleBlur() {
      if (this.valueChecker) {
        window.clearInterval(this.valueChecker);
      }
    }
    updateIfValueChanged() {
      if (this.$textarea.value !== this.lastInputValue) {
        this.lastInputValue = this.$textarea.value;
        this.updateCountMessage();
      }
    }
    updateCountMessage() {
      this.updateVisibleCountMessage();
      this.updateScreenReaderCountMessage();
    }
    updateVisibleCountMessage() {
      const remainingNumber = this.maxLength - this.count(this.$textarea.value);
      const isError = remainingNumber < 0;
      this.$visibleCountMessage.classList.toggle('govuk-character-count__message--disabled', !this.isOverThreshold());
      this.$textarea.classList.toggle('govuk-textarea--error', isError);
      this.$visibleCountMessage.classList.toggle('govuk-error-message', isError);
      this.$visibleCountMessage.classList.toggle('govuk-hint', !isError);
      this.$visibleCountMessage.textContent = this.getCountMessage();
    }
    updateScreenReaderCountMessage() {
      if (this.isOverThreshold()) {
        this.$screenReaderCountMessage.removeAttribute('aria-hidden');
      } else {
        this.$screenReaderCountMessage.setAttribute('aria-hidden', 'true');
      }
      this.$screenReaderCountMessage.textContent = this.getCountMessage();
    }
    count(text) {
      if (this.config.maxwords) {
        var _text$match;
        const tokens = (_text$match = text.match(/\S+/g)) != null ? _text$match : [];
        return tokens.length;
      }
      return text.length;
    }
    getCountMessage() {
      const remainingNumber = this.maxLength - this.count(this.$textarea.value);
      const countType = this.config.maxwords ? 'words' : 'characters';
      return this.formatCountMessage(remainingNumber, countType);
    }
    formatCountMessage(remainingNumber, countType) {
      if (remainingNumber === 0) {
        return this.i18n.t(`${countType}AtLimit`);
      }
      const translationKeySuffix = remainingNumber < 0 ? 'OverLimit' : 'UnderLimit';
      return this.i18n.t(`${countType}${translationKeySuffix}`, {
        count: Math.abs(remainingNumber)
      });
    }
    isOverThreshold() {
      if (!this.config.threshold) {
        return true;
      }
      const currentLength = this.count(this.$textarea.value);
      const maxLength = this.maxLength;
      const thresholdValue = maxLength * this.config.threshold / 100;
      return thresholdValue <= currentLength;
    }
  }

  /**
   * Character count config
   *
   * @see {@link CharacterCount.defaults}
   * @typedef {object} CharacterCountConfig
   * @property {number} [maxlength] - The maximum number of characters.
   *   If maxwords is provided, the maxlength option will be ignored.
   * @property {number} [maxwords] - The maximum number of words. If maxwords is
   *   provided, the maxlength option will be ignored.
   * @property {number} [threshold=0] - The percentage value of the limit at
   *   which point the count message is displayed. If this attribute is set, the
   *   count message will be hidden by default.
   * @property {CharacterCountTranslations} [i18n=CharacterCount.defaults.i18n] - Character count translations
   */

  /**
   * Character count translations
   *
   * @see {@link CharacterCount.defaults.i18n}
   * @typedef {object} CharacterCountTranslations
   *
   * Messages shown to users as they type. It provides feedback on how many words
   * or characters they have remaining or if they are over the limit. This also
   * includes a message used as an accessible description for the textarea.
   * @property {TranslationPluralForms} [charactersUnderLimit] - Message displayed
   *   when the number of characters is under the configured maximum, `maxlength`.
   *   This message is displayed visually and through assistive technologies. The
   *   component will replace the `%{count}` placeholder with the number of
   *   remaining characters. This is a [pluralised list of
   *   messages](https://frontend.design-system.service.gov.uk/localise-govuk-frontend).
   * @property {string} [charactersAtLimit] - Message displayed when the number of
   *   characters reaches the configured maximum, `maxlength`. This message is
   *   displayed visually and through assistive technologies.
   * @property {TranslationPluralForms} [charactersOverLimit] - Message displayed
   *   when the number of characters is over the configured maximum, `maxlength`.
   *   This message is displayed visually and through assistive technologies. The
   *   component will replace the `%{count}` placeholder with the number of
   *   remaining characters. This is a [pluralised list of
   *   messages](https://frontend.design-system.service.gov.uk/localise-govuk-frontend).
   * @property {TranslationPluralForms} [wordsUnderLimit] - Message displayed when
   *   the number of words is under the configured maximum, `maxlength`. This
   *   message is displayed visually and through assistive technologies. The
   *   component will replace the `%{count}` placeholder with the number of
   *   remaining words. This is a [pluralised list of
   *   messages](https://frontend.design-system.service.gov.uk/localise-govuk-frontend).
   * @property {string} [wordsAtLimit] - Message displayed when the number of
   *   words reaches the configured maximum, `maxlength`. This message is
   *   displayed visually and through assistive technologies.
   * @property {TranslationPluralForms} [wordsOverLimit] - Message displayed when
   *   the number of words is over the configured maximum, `maxlength`. This
   *   message is displayed visually and through assistive technologies. The
   *   component will replace the `%{count}` placeholder with the number of
   *   remaining words. This is a [pluralised list of
   *   messages](https://frontend.design-system.service.gov.uk/localise-govuk-frontend).
   * @property {TranslationPluralForms} [textareaDescription] - Message made
   *   available to assistive technologies, if none is already present in the
   *   HTML, to describe that the component accepts only a limited amount of
   *   content. It is visible on the page when JavaScript is unavailable. The
   *   component will replace the `%{count}` placeholder with the value of the
   *   `maxlength` or `maxwords` parameter.
   */

  /**
   * @typedef {import('../../common/index.mjs').Schema} Schema
   * @typedef {import('../../i18n.mjs').TranslationPluralForms} TranslationPluralForms
   */
  CharacterCount.moduleName = 'govuk-character-count';
  CharacterCount.defaults = Object.freeze({
    threshold: 0,
    i18n: {
      charactersUnderLimit: {
        one: 'You have %{count} character remaining',
        other: 'You have %{count} characters remaining'
      },
      charactersAtLimit: 'You have 0 characters remaining',
      charactersOverLimit: {
        one: 'You have %{count} character too many',
        other: 'You have %{count} characters too many'
      },
      wordsUnderLimit: {
        one: 'You have %{count} word remaining',
        other: 'You have %{count} words remaining'
      },
      wordsAtLimit: 'You have 0 words remaining',
      wordsOverLimit: {
        one: 'You have %{count} word too many',
        other: 'You have %{count} words too many'
      },
      textareaDescription: {
        other: ''
      }
    }
  });
  CharacterCount.schema = Object.freeze({
    anyOf: [{
      required: ['maxwords'],
      errorMessage: 'Either "maxlength" or "maxwords" must be provided'
    }, {
      required: ['maxlength'],
      errorMessage: 'Either "maxlength" or "maxwords" must be provided'
    }]
  });

  /**
   * Checkboxes component
   *
   * @preserve
   */
  class Checkboxes extends GOVUKFrontendComponent {
    /**
     * Checkboxes can be associated with a 'conditionally revealed' content block
     * – for example, a checkbox for 'Phone' could reveal an additional form field
     * for the user to enter their phone number.
     *
     * These associations are made using a `data-aria-controls` attribute, which
     * is promoted to an aria-controls attribute during initialisation.
     *
     * We also need to restore the state of any conditional reveals on the page
     * (for example if the user has navigated back), and set up event handlers to
     * keep the reveal in sync with the checkbox state.
     *
     * @param {Element | null} $module - HTML element to use for checkboxes
     */
    constructor($module) {
      super();
      this.$module = void 0;
      this.$inputs = void 0;
      if (!($module instanceof HTMLElement)) {
        throw new ElementError({
          componentName: 'Checkboxes',
          element: $module,
          identifier: 'Root element (`$module`)'
        });
      }
      const $inputs = $module.querySelectorAll('input[type="checkbox"]');
      if (!$inputs.length) {
        throw new ElementError({
          componentName: 'Checkboxes',
          identifier: 'Form inputs (`<input type="checkbox">`)'
        });
      }
      this.$module = $module;
      this.$inputs = $inputs;
      this.$inputs.forEach($input => {
        const targetId = $input.getAttribute('data-aria-controls');
        if (!targetId) {
          return;
        }
        if (!document.getElementById(targetId)) {
          throw new ElementError({
            componentName: 'Checkboxes',
            identifier: `Conditional reveal (\`id="${targetId}"\`)`
          });
        }
        $input.setAttribute('aria-controls', targetId);
        $input.removeAttribute('data-aria-controls');
      });
      window.addEventListener('pageshow', () => this.syncAllConditionalReveals());
      this.syncAllConditionalReveals();
      this.$module.addEventListener('click', event => this.handleClick(event));
    }
    syncAllConditionalReveals() {
      this.$inputs.forEach($input => this.syncConditionalRevealWithInputState($input));
    }
    syncConditionalRevealWithInputState($input) {
      const targetId = $input.getAttribute('aria-controls');
      if (!targetId) {
        return;
      }
      const $target = document.getElementById(targetId);
      if ($target && $target.classList.contains('govuk-checkboxes__conditional')) {
        const inputIsChecked = $input.checked;
        $input.setAttribute('aria-expanded', inputIsChecked.toString());
        $target.classList.toggle('govuk-checkboxes__conditional--hidden', !inputIsChecked);
      }
    }
    unCheckAllInputsExcept($input) {
      const allInputsWithSameName = document.querySelectorAll(`input[type="checkbox"][name="${$input.name}"]`);
      allInputsWithSameName.forEach($inputWithSameName => {
        const hasSameFormOwner = $input.form === $inputWithSameName.form;
        if (hasSameFormOwner && $inputWithSameName !== $input) {
          $inputWithSameName.checked = false;
          this.syncConditionalRevealWithInputState($inputWithSameName);
        }
      });
    }
    unCheckExclusiveInputs($input) {
      const allInputsWithSameNameAndExclusiveBehaviour = document.querySelectorAll(`input[data-behaviour="exclusive"][type="checkbox"][name="${$input.name}"]`);
      allInputsWithSameNameAndExclusiveBehaviour.forEach($exclusiveInput => {
        const hasSameFormOwner = $input.form === $exclusiveInput.form;
        if (hasSameFormOwner) {
          $exclusiveInput.checked = false;
          this.syncConditionalRevealWithInputState($exclusiveInput);
        }
      });
    }
    handleClick(event) {
      const $clickedInput = event.target;
      if (!($clickedInput instanceof HTMLInputElement) || $clickedInput.type !== 'checkbox') {
        return;
      }
      const hasAriaControls = $clickedInput.getAttribute('aria-controls');
      if (hasAriaControls) {
        this.syncConditionalRevealWithInputState($clickedInput);
      }
      if (!$clickedInput.checked) {
        return;
      }
      const hasBehaviourExclusive = $clickedInput.getAttribute('data-behaviour') === 'exclusive';
      if (hasBehaviourExclusive) {
        this.unCheckAllInputsExcept($clickedInput);
      } else {
        this.unCheckExclusiveInputs($clickedInput);
      }
    }
  }
  Checkboxes.moduleName = 'govuk-checkboxes';

  /**
   * Error summary component
   *
   * Takes focus on initialisation for accessible announcement, unless disabled in
   * configuration.
   *
   * @preserve
   */
  class ErrorSummary extends GOVUKFrontendComponent {
    /**
     * @param {Element | null} $module - HTML element to use for error summary
     * @param {ErrorSummaryConfig} [config] - Error summary config
     */
    constructor($module, config = {}) {
      super();
      this.$module = void 0;
      this.config = void 0;
      if (!($module instanceof HTMLElement)) {
        throw new ElementError({
          componentName: 'Error summary',
          element: $module,
          identifier: 'Root element (`$module`)'
        });
      }
      this.$module = $module;
      this.config = mergeConfigs(ErrorSummary.defaults, config, normaliseDataset($module.dataset));
      if (!this.config.disableAutoFocus) {
        setFocus(this.$module);
      }
      this.$module.addEventListener('click', event => this.handleClick(event));
    }
    handleClick(event) {
      const $target = event.target;
      if ($target && this.focusTarget($target)) {
        event.preventDefault();
      }
    }
    focusTarget($target) {
      if (!($target instanceof HTMLAnchorElement)) {
        return false;
      }
      const inputId = getFragmentFromUrl($target.href);
      if (!inputId) {
        return false;
      }
      const $input = document.getElementById(inputId);
      if (!$input) {
        return false;
      }
      const $legendOrLabel = this.getAssociatedLegendOrLabel($input);
      if (!$legendOrLabel) {
        return false;
      }
      $legendOrLabel.scrollIntoView();
      $input.focus({
        preventScroll: true
      });
      return true;
    }
    getAssociatedLegendOrLabel($input) {
      var _document$querySelect;
      const $fieldset = $input.closest('fieldset');
      if ($fieldset) {
        const $legends = $fieldset.getElementsByTagName('legend');
        if ($legends.length) {
          const $candidateLegend = $legends[0];
          if ($input instanceof HTMLInputElement && ($input.type === 'checkbox' || $input.type === 'radio')) {
            return $candidateLegend;
          }
          const legendTop = $candidateLegend.getBoundingClientRect().top;
          const inputRect = $input.getBoundingClientRect();
          if (inputRect.height && window.innerHeight) {
            const inputBottom = inputRect.top + inputRect.height;
            if (inputBottom - legendTop < window.innerHeight / 2) {
              return $candidateLegend;
            }
          }
        }
      }
      return (_document$querySelect = document.querySelector(`label[for='${$input.getAttribute('id')}']`)) != null ? _document$querySelect : $input.closest('label');
    }
  }

  /**
   * Error summary config
   *
   * @typedef {object} ErrorSummaryConfig
   * @property {boolean} [disableAutoFocus=false] - If set to `true` the error
   *   summary will not be focussed when the page loads.
   */
  ErrorSummary.moduleName = 'govuk-error-summary';
  ErrorSummary.defaults = Object.freeze({
    disableAutoFocus: false
  });

  /**
   * Exit this page component
   *
   * @preserve
   */
  class ExitThisPage extends GOVUKFrontendComponent {
    /**
     * @param {Element | null} $module - HTML element that wraps the Exit This Page button
     * @param {ExitThisPageConfig} [config] - Exit This Page config
     */
    constructor($module, config = {}) {
      super();
      this.$module = void 0;
      this.config = void 0;
      this.i18n = void 0;
      this.$button = void 0;
      this.$skiplinkButton = null;
      this.$updateSpan = null;
      this.$indicatorContainer = null;
      this.$overlay = null;
      this.keypressCounter = 0;
      this.lastKeyWasModified = false;
      this.timeoutTime = 5000;
      this.keypressTimeoutId = null;
      this.timeoutMessageId = null;
      if (!($module instanceof HTMLElement)) {
        throw new ElementError({
          componentName: 'Exit this page',
          element: $module,
          identifier: 'Root element (`$module`)'
        });
      }
      const $button = $module.querySelector('.govuk-exit-this-page__button');
      if (!($button instanceof HTMLAnchorElement)) {
        throw new ElementError({
          componentName: 'Exit this page',
          element: $button,
          expectedType: 'HTMLAnchorElement',
          identifier: 'Button (`.govuk-exit-this-page__button`)'
        });
      }
      this.config = mergeConfigs(ExitThisPage.defaults, config, normaliseDataset($module.dataset));
      this.i18n = new I18n(extractConfigByNamespace(this.config, 'i18n'));
      this.$module = $module;
      this.$button = $button;
      const $skiplinkButton = document.querySelector('.govuk-js-exit-this-page-skiplink');
      if ($skiplinkButton instanceof HTMLAnchorElement) {
        this.$skiplinkButton = $skiplinkButton;
      }
      this.buildIndicator();
      this.initUpdateSpan();
      this.initButtonClickHandler();
      if (!('govukFrontendExitThisPageKeypress' in document.body.dataset)) {
        document.addEventListener('keyup', this.handleKeypress.bind(this), true);
        document.body.dataset.govukFrontendExitThisPageKeypress = 'true';
      }
      window.addEventListener('pageshow', this.resetPage.bind(this));
    }
    initUpdateSpan() {
      this.$updateSpan = document.createElement('span');
      this.$updateSpan.setAttribute('role', 'status');
      this.$updateSpan.className = 'govuk-visually-hidden';
      this.$module.appendChild(this.$updateSpan);
    }
    initButtonClickHandler() {
      this.$button.addEventListener('click', this.handleClick.bind(this));
      if (this.$skiplinkButton) {
        this.$skiplinkButton.addEventListener('click', this.handleClick.bind(this));
      }
    }
    buildIndicator() {
      this.$indicatorContainer = document.createElement('div');
      this.$indicatorContainer.className = 'govuk-exit-this-page__indicator';
      this.$indicatorContainer.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 3; i++) {
        const $indicator = document.createElement('div');
        $indicator.className = 'govuk-exit-this-page__indicator-light';
        this.$indicatorContainer.appendChild($indicator);
      }
      this.$button.appendChild(this.$indicatorContainer);
    }
    updateIndicator() {
      if (!this.$indicatorContainer) {
        return;
      }
      this.$indicatorContainer.classList.toggle('govuk-exit-this-page__indicator--visible', this.keypressCounter > 0);
      const $indicators = this.$indicatorContainer.querySelectorAll('.govuk-exit-this-page__indicator-light');
      $indicators.forEach(($indicator, index) => {
        $indicator.classList.toggle('govuk-exit-this-page__indicator-light--on', index < this.keypressCounter);
      });
    }
    exitPage() {
      if (!this.$updateSpan) {
        return;
      }
      this.$updateSpan.textContent = '';
      document.body.classList.add('govuk-exit-this-page-hide-content');
      this.$overlay = document.createElement('div');
      this.$overlay.className = 'govuk-exit-this-page-overlay';
      this.$overlay.setAttribute('role', 'alert');
      document.body.appendChild(this.$overlay);
      this.$overlay.textContent = this.i18n.t('activated');
      window.location.href = this.$button.href;
    }
    handleClick(event) {
      event.preventDefault();
      this.exitPage();
    }
    handleKeypress(event) {
      if (!this.$updateSpan) {
        return;
      }
      if ((event.key === 'Shift' || event.keyCode === 16 || event.which === 16) && !this.lastKeyWasModified) {
        this.keypressCounter += 1;
        this.updateIndicator();
        if (this.timeoutMessageId) {
          window.clearTimeout(this.timeoutMessageId);
          this.timeoutMessageId = null;
        }
        if (this.keypressCounter >= 3) {
          this.keypressCounter = 0;
          if (this.keypressTimeoutId) {
            window.clearTimeout(this.keypressTimeoutId);
            this.keypressTimeoutId = null;
          }
          this.exitPage();
        } else {
          if (this.keypressCounter === 1) {
            this.$updateSpan.textContent = this.i18n.t('pressTwoMoreTimes');
          } else {
            this.$updateSpan.textContent = this.i18n.t('pressOneMoreTime');
          }
        }
        this.setKeypressTimer();
      } else if (this.keypressTimeoutId) {
        this.resetKeypressTimer();
      }
      this.lastKeyWasModified = event.shiftKey;
    }
    setKeypressTimer() {
      if (this.keypressTimeoutId) {
        window.clearTimeout(this.keypressTimeoutId);
      }
      this.keypressTimeoutId = window.setTimeout(this.resetKeypressTimer.bind(this), this.timeoutTime);
    }
    resetKeypressTimer() {
      if (!this.$updateSpan) {
        return;
      }
      if (this.keypressTimeoutId) {
        window.clearTimeout(this.keypressTimeoutId);
        this.keypressTimeoutId = null;
      }
      const $updateSpan = this.$updateSpan;
      this.keypressCounter = 0;
      $updateSpan.textContent = this.i18n.t('timedOut');
      this.timeoutMessageId = window.setTimeout(() => {
        $updateSpan.textContent = '';
      }, this.timeoutTime);
      this.updateIndicator();
    }
    resetPage() {
      document.body.classList.remove('govuk-exit-this-page-hide-content');
      if (this.$overlay) {
        this.$overlay.remove();
        this.$overlay = null;
      }
      if (this.$updateSpan) {
        this.$updateSpan.setAttribute('role', 'status');
        this.$updateSpan.textContent = '';
      }
      this.updateIndicator();
      if (this.keypressTimeoutId) {
        window.clearTimeout(this.keypressTimeoutId);
      }
      if (this.timeoutMessageId) {
        window.clearTimeout(this.timeoutMessageId);
      }
    }
  }

  /**
   * Exit this Page config
   *
   * @see {@link ExitThisPage.defaults}
   * @typedef {object} ExitThisPageConfig
   * @property {ExitThisPageTranslations} [i18n=ExitThisPage.defaults.i18n] - Exit this page translations
   */

  /**
   * Exit this Page translations
   *
   * @see {@link ExitThisPage.defaults.i18n}
   * @typedef {object} ExitThisPageTranslations
   *
   * Messages used by the component programatically inserted text, including
   * overlay text and screen reader announcements.
   * @property {string} [activated] - Screen reader announcement for when EtP
   *   keypress functionality has been successfully activated.
   * @property {string} [timedOut] - Screen reader announcement for when the EtP
   *   keypress functionality has timed out.
   * @property {string} [pressTwoMoreTimes] - Screen reader announcement informing
   *   the user they must press the activation key two more times.
   * @property {string} [pressOneMoreTime] - Screen reader announcement informing
   *   the user they must press the activation key one more time.
   */
  ExitThisPage.moduleName = 'govuk-exit-this-page';
  ExitThisPage.defaults = Object.freeze({
    i18n: {
      activated: 'Loading.',
      timedOut: 'Exit this page expired.',
      pressTwoMoreTimes: 'Shift, press 2 more times to exit.',
      pressOneMoreTime: 'Shift, press 1 more time to exit.'
    }
  });

  /**
   * Header component
   *
   * @preserve
   */
  class Header extends GOVUKFrontendComponent {
    /**
     * Apply a matchMedia for desktop which will trigger a state sync if the
     * browser viewport moves between states.
     *
     * @param {Element | null} $module - HTML element to use for header
     */
    constructor($module) {
      super();
      this.$module = void 0;
      this.$menuButton = void 0;
      this.$menu = void 0;
      this.menuIsOpen = false;
      this.mql = null;
      if (!$module) {
        throw new ElementError({
          componentName: 'Header',
          element: $module,
          identifier: 'Root element (`$module`)'
        });
      }
      this.$module = $module;
      const $menuButton = $module.querySelector('.govuk-js-header-toggle');
      if (!$menuButton) {
        return this;
      }
      const menuId = $menuButton.getAttribute('aria-controls');
      if (!menuId) {
        throw new ElementError({
          componentName: 'Header',
          identifier: 'Navigation button (`<button class="govuk-js-header-toggle">`) attribute (`aria-controls`)'
        });
      }
      const $menu = document.getElementById(menuId);
      if (!$menu) {
        throw new ElementError({
          componentName: 'Header',
          element: $menu,
          identifier: `Navigation (\`<ul id="${menuId}">\`)`
        });
      }
      this.$menu = $menu;
      this.$menuButton = $menuButton;
      this.setupResponsiveChecks();
      this.$menuButton.addEventListener('click', () => this.handleMenuButtonClick());
    }
    setupResponsiveChecks() {
      const breakpoint = getBreakpoint('desktop');
      if (!breakpoint.value) {
        throw new ElementError({
          componentName: 'Header',
          identifier: `CSS custom property (\`${breakpoint.property}\`) on pseudo-class \`:root\``
        });
      }
      this.mql = window.matchMedia(`(min-width: ${breakpoint.value})`);
      if ('addEventListener' in this.mql) {
        this.mql.addEventListener('change', () => this.checkMode());
      } else {
        this.mql.addListener(() => this.checkMode());
      }
      this.checkMode();
    }
    checkMode() {
      if (!this.mql || !this.$menu || !this.$menuButton) {
        return;
      }
      if (this.mql.matches) {
        this.$menu.removeAttribute('hidden');
        this.$menuButton.setAttribute('hidden', '');
      } else {
        this.$menuButton.removeAttribute('hidden');
        this.$menuButton.setAttribute('aria-expanded', this.menuIsOpen.toString());
        if (this.menuIsOpen) {
          this.$menu.removeAttribute('hidden');
        } else {
          this.$menu.setAttribute('hidden', '');
        }
      }
    }
    handleMenuButtonClick() {
      this.menuIsOpen = !this.menuIsOpen;
      this.checkMode();
    }
  }
  Header.moduleName = 'govuk-header';

  /**
   * Notification Banner component
   *
   * @preserve
   */
  class NotificationBanner extends GOVUKFrontendComponent {
    /**
     * @param {Element | null} $module - HTML element to use for notification banner
     * @param {NotificationBannerConfig} [config] - Notification banner config
     */
    constructor($module, config = {}) {
      super();
      this.$module = void 0;
      this.config = void 0;
      if (!($module instanceof HTMLElement)) {
        throw new ElementError({
          componentName: 'Notification banner',
          element: $module,
          identifier: 'Root element (`$module`)'
        });
      }
      this.$module = $module;
      this.config = mergeConfigs(NotificationBanner.defaults, config, normaliseDataset($module.dataset));
      if (this.$module.getAttribute('role') === 'alert' && !this.config.disableAutoFocus) {
        setFocus(this.$module);
      }
    }
  }

  /**
   * Notification banner config
   *
   * @typedef {object} NotificationBannerConfig
   * @property {boolean} [disableAutoFocus=false] - If set to `true` the
   *   notification banner will not be focussed when the page loads. This only
   *   applies if the component has a `role` of `alert` – in other cases the
   *   component will not be focused on page load, regardless of this option.
   */
  NotificationBanner.moduleName = 'govuk-notification-banner';
  NotificationBanner.defaults = Object.freeze({
    disableAutoFocus: false
  });

  /**
   * Radios component
   *
   * @preserve
   */
  class Radios extends GOVUKFrontendComponent {
    /**
     * Radios can be associated with a 'conditionally revealed' content block –
     * for example, a radio for 'Phone' could reveal an additional form field for
     * the user to enter their phone number.
     *
     * These associations are made using a `data-aria-controls` attribute, which
     * is promoted to an aria-controls attribute during initialisation.
     *
     * We also need to restore the state of any conditional reveals on the page
     * (for example if the user has navigated back), and set up event handlers to
     * keep the reveal in sync with the radio state.
     *
     * @param {Element | null} $module - HTML element to use for radios
     */
    constructor($module) {
      super();
      this.$module = void 0;
      this.$inputs = void 0;
      if (!($module instanceof HTMLElement)) {
        throw new ElementError({
          componentName: 'Radios',
          element: $module,
          identifier: 'Root element (`$module`)'
        });
      }
      const $inputs = $module.querySelectorAll('input[type="radio"]');
      if (!$inputs.length) {
        throw new ElementError({
          componentName: 'Radios',
          identifier: 'Form inputs (`<input type="radio">`)'
        });
      }
      this.$module = $module;
      this.$inputs = $inputs;
      this.$inputs.forEach($input => {
        const targetId = $input.getAttribute('data-aria-controls');
        if (!targetId) {
          return;
        }
        if (!document.getElementById(targetId)) {
          throw new ElementError({
            componentName: 'Radios',
            identifier: `Conditional reveal (\`id="${targetId}"\`)`
          });
        }
        $input.setAttribute('aria-controls', targetId);
        $input.removeAttribute('data-aria-controls');
      });
      window.addEventListener('pageshow', () => this.syncAllConditionalReveals());
      this.syncAllConditionalReveals();
      this.$module.addEventListener('click', event => this.handleClick(event));
    }
    syncAllConditionalReveals() {
      this.$inputs.forEach($input => this.syncConditionalRevealWithInputState($input));
    }
    syncConditionalRevealWithInputState($input) {
      const targetId = $input.getAttribute('aria-controls');
      if (!targetId) {
        return;
      }
      const $target = document.getElementById(targetId);
      if ($target != null && $target.classList.contains('govuk-radios__conditional')) {
        const inputIsChecked = $input.checked;
        $input.setAttribute('aria-expanded', inputIsChecked.toString());
        $target.classList.toggle('govuk-radios__conditional--hidden', !inputIsChecked);
      }
    }
    handleClick(event) {
      const $clickedInput = event.target;
      if (!($clickedInput instanceof HTMLInputElement) || $clickedInput.type !== 'radio') {
        return;
      }
      const $allInputs = document.querySelectorAll('input[type="radio"][aria-controls]');
      const $clickedInputForm = $clickedInput.form;
      const $clickedInputName = $clickedInput.name;
      $allInputs.forEach($input => {
        const hasSameFormOwner = $input.form === $clickedInputForm;
        const hasSameName = $input.name === $clickedInputName;
        if (hasSameName && hasSameFormOwner) {
          this.syncConditionalRevealWithInputState($input);
        }
      });
    }
  }
  Radios.moduleName = 'govuk-radios';

  /**
   * Skip link component
   *
   * @preserve
   */
  class SkipLink extends GOVUKFrontendComponent {
    /**
     * @param {Element | null} $module - HTML element to use for skip link
     * @throws {ElementError} when $module is not set or the wrong type
     * @throws {ElementError} when $module.hash does not contain a hash
     * @throws {ElementError} when the linked element is missing or the wrong type
     */
    constructor($module) {
      var _this$$module$getAttr;
      super();
      this.$module = void 0;
      if (!($module instanceof HTMLAnchorElement)) {
        throw new ElementError({
          componentName: 'Skip link',
          element: $module,
          expectedType: 'HTMLAnchorElement',
          identifier: 'Root element (`$module`)'
        });
      }
      this.$module = $module;
      const hash = this.$module.hash;
      const href = (_this$$module$getAttr = this.$module.getAttribute('href')) != null ? _this$$module$getAttr : '';
      let url;
      try {
        url = new window.URL(this.$module.href);
      } catch (error) {
        throw new ElementError(`Skip link: Target link (\`href="${href}"\`) is invalid`);
      }
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) {
        return;
      }
      const linkedElementId = getFragmentFromUrl(hash);
      if (!linkedElementId) {
        throw new ElementError(`Skip link: Target link (\`href="${href}"\`) has no hash fragment`);
      }
      const $linkedElement = document.getElementById(linkedElementId);
      if (!$linkedElement) {
        throw new ElementError({
          componentName: 'Skip link',
          element: $linkedElement,
          identifier: `Target content (\`id="${linkedElementId}"\`)`
        });
      }
      this.$module.addEventListener('click', () => setFocus($linkedElement, {
        onBeforeFocus() {
          $linkedElement.classList.add('govuk-skip-link-focused-element');
        },
        onBlur() {
          $linkedElement.classList.remove('govuk-skip-link-focused-element');
        }
      }));
    }
  }
  SkipLink.moduleName = 'govuk-skip-link';

  /**
   * Tabs component
   *
   * @preserve
   */
  class Tabs extends GOVUKFrontendComponent {
    /**
     * @param {Element | null} $module - HTML element to use for tabs
     */
    constructor($module) {
      super();
      this.$module = void 0;
      this.$tabs = void 0;
      this.$tabList = void 0;
      this.$tabListItems = void 0;
      this.keys = {
        left: 37,
        right: 39,
        up: 38,
        down: 40
      };
      this.jsHiddenClass = 'govuk-tabs__panel--hidden';
      this.changingHash = false;
      this.boundTabClick = void 0;
      this.boundTabKeydown = void 0;
      this.boundOnHashChange = void 0;
      this.mql = null;
      if (!$module) {
        throw new ElementError({
          componentName: 'Tabs',
          element: $module,
          identifier: 'Root element (`$module`)'
        });
      }
      const $tabs = $module.querySelectorAll('a.govuk-tabs__tab');
      if (!$tabs.length) {
        throw new ElementError({
          componentName: 'Tabs',
          identifier: 'Links (`<a class="govuk-tabs__tab">`)'
        });
      }
      this.$module = $module;
      this.$tabs = $tabs;
      this.boundTabClick = this.onTabClick.bind(this);
      this.boundTabKeydown = this.onTabKeydown.bind(this);
      this.boundOnHashChange = this.onHashChange.bind(this);
      const $tabList = this.$module.querySelector('.govuk-tabs__list');
      const $tabListItems = this.$module.querySelectorAll('li.govuk-tabs__list-item');
      if (!$tabList) {
        throw new ElementError({
          componentName: 'Tabs',
          identifier: 'List (`<ul class="govuk-tabs__list">`)'
        });
      }
      if (!$tabListItems.length) {
        throw new ElementError({
          componentName: 'Tabs',
          identifier: 'List items (`<li class="govuk-tabs__list-item">`)'
        });
      }
      this.$tabList = $tabList;
      this.$tabListItems = $tabListItems;
      this.setupResponsiveChecks();
    }
    setupResponsiveChecks() {
      const breakpoint = getBreakpoint('tablet');
      if (!breakpoint.value) {
        throw new ElementError({
          componentName: 'Tabs',
          identifier: `CSS custom property (\`${breakpoint.property}\`) on pseudo-class \`:root\``
        });
      }
      this.mql = window.matchMedia(`(min-width: ${breakpoint.value})`);
      if ('addEventListener' in this.mql) {
        this.mql.addEventListener('change', () => this.checkMode());
      } else {
        this.mql.addListener(() => this.checkMode());
      }
      this.checkMode();
    }
    checkMode() {
      var _this$mql;
      if ((_this$mql = this.mql) != null && _this$mql.matches) {
        this.setup();
      } else {
        this.teardown();
      }
    }
    setup() {
      var _this$getTab;
      this.$tabList.setAttribute('role', 'tablist');
      this.$tabListItems.forEach($item => {
        $item.setAttribute('role', 'presentation');
      });
      this.$tabs.forEach($tab => {
        this.setAttributes($tab);
        $tab.addEventListener('click', this.boundTabClick, true);
        $tab.addEventListener('keydown', this.boundTabKeydown, true);
        this.hideTab($tab);
      });
      const $activeTab = (_this$getTab = this.getTab(window.location.hash)) != null ? _this$getTab : this.$tabs[0];
      this.showTab($activeTab);
      window.addEventListener('hashchange', this.boundOnHashChange, true);
    }
    teardown() {
      this.$tabList.removeAttribute('role');
      this.$tabListItems.forEach($item => {
        $item.removeAttribute('role');
      });
      this.$tabs.forEach($tab => {
        $tab.removeEventListener('click', this.boundTabClick, true);
        $tab.removeEventListener('keydown', this.boundTabKeydown, true);
        this.unsetAttributes($tab);
      });
      window.removeEventListener('hashchange', this.boundOnHashChange, true);
    }
    onHashChange() {
      const hash = window.location.hash;
      const $tabWithHash = this.getTab(hash);
      if (!$tabWithHash) {
        return;
      }
      if (this.changingHash) {
        this.changingHash = false;
        return;
      }
      const $previousTab = this.getCurrentTab();
      if (!$previousTab) {
        return;
      }
      this.hideTab($previousTab);
      this.showTab($tabWithHash);
      $tabWithHash.focus();
    }
    hideTab($tab) {
      this.unhighlightTab($tab);
      this.hidePanel($tab);
    }
    showTab($tab) {
      this.highlightTab($tab);
      this.showPanel($tab);
    }
    getTab(hash) {
      return this.$module.querySelector(`a.govuk-tabs__tab[href="${hash}"]`);
    }
    setAttributes($tab) {
      const panelId = getFragmentFromUrl($tab.href);
      if (!panelId) {
        return;
      }
      $tab.setAttribute('id', `tab_${panelId}`);
      $tab.setAttribute('role', 'tab');
      $tab.setAttribute('aria-controls', panelId);
      $tab.setAttribute('aria-selected', 'false');
      $tab.setAttribute('tabindex', '-1');
      const $panel = this.getPanel($tab);
      if (!$panel) {
        return;
      }
      $panel.setAttribute('role', 'tabpanel');
      $panel.setAttribute('aria-labelledby', $tab.id);
      $panel.classList.add(this.jsHiddenClass);
    }
    unsetAttributes($tab) {
      $tab.removeAttribute('id');
      $tab.removeAttribute('role');
      $tab.removeAttribute('aria-controls');
      $tab.removeAttribute('aria-selected');
      $tab.removeAttribute('tabindex');
      const $panel = this.getPanel($tab);
      if (!$panel) {
        return;
      }
      $panel.removeAttribute('role');
      $panel.removeAttribute('aria-labelledby');
      $panel.classList.remove(this.jsHiddenClass);
    }
    onTabClick(event) {
      const $currentTab = this.getCurrentTab();
      const $nextTab = event.currentTarget;
      if (!$currentTab || !($nextTab instanceof HTMLAnchorElement)) {
        return;
      }
      event.preventDefault();
      this.hideTab($currentTab);
      this.showTab($nextTab);
      this.createHistoryEntry($nextTab);
    }
    createHistoryEntry($tab) {
      const $panel = this.getPanel($tab);
      if (!$panel) {
        return;
      }
      const panelId = $panel.id;
      $panel.id = '';
      this.changingHash = true;
      window.location.hash = panelId;
      $panel.id = panelId;
    }
    onTabKeydown(event) {
      switch (event.keyCode) {
        case this.keys.left:
        case this.keys.up:
          this.activatePreviousTab();
          event.preventDefault();
          break;
        case this.keys.right:
        case this.keys.down:
          this.activateNextTab();
          event.preventDefault();
          break;
      }
    }
    activateNextTab() {
      const $currentTab = this.getCurrentTab();
      if (!($currentTab != null && $currentTab.parentElement)) {
        return;
      }
      const $nextTabListItem = $currentTab.parentElement.nextElementSibling;
      if (!$nextTabListItem) {
        return;
      }
      const $nextTab = $nextTabListItem.querySelector('a.govuk-tabs__tab');
      if (!$nextTab) {
        return;
      }
      this.hideTab($currentTab);
      this.showTab($nextTab);
      $nextTab.focus();
      this.createHistoryEntry($nextTab);
    }
    activatePreviousTab() {
      const $currentTab = this.getCurrentTab();
      if (!($currentTab != null && $currentTab.parentElement)) {
        return;
      }
      const $previousTabListItem = $currentTab.parentElement.previousElementSibling;
      if (!$previousTabListItem) {
        return;
      }
      const $previousTab = $previousTabListItem.querySelector('a.govuk-tabs__tab');
      if (!$previousTab) {
        return;
      }
      this.hideTab($currentTab);
      this.showTab($previousTab);
      $previousTab.focus();
      this.createHistoryEntry($previousTab);
    }
    getPanel($tab) {
      const panelId = getFragmentFromUrl($tab.href);
      if (!panelId) {
        return null;
      }
      return this.$module.querySelector(`#${panelId}`);
    }
    showPanel($tab) {
      const $panel = this.getPanel($tab);
      if (!$panel) {
        return;
      }
      $panel.classList.remove(this.jsHiddenClass);
    }
    hidePanel($tab) {
      const $panel = this.getPanel($tab);
      if (!$panel) {
        return;
      }
      $panel.classList.add(this.jsHiddenClass);
    }
    unhighlightTab($tab) {
      if (!$tab.parentElement) {
        return;
      }
      $tab.setAttribute('aria-selected', 'false');
      $tab.parentElement.classList.remove('govuk-tabs__list-item--selected');
      $tab.setAttribute('tabindex', '-1');
    }
    highlightTab($tab) {
      if (!$tab.parentElement) {
        return;
      }
      $tab.setAttribute('aria-selected', 'true');
      $tab.parentElement.classList.add('govuk-tabs__list-item--selected');
      $tab.setAttribute('tabindex', '0');
    }
    getCurrentTab() {
      return this.$module.querySelector('.govuk-tabs__list-item--selected a.govuk-tabs__tab');
    }
  }
  Tabs.moduleName = 'govuk-tabs';

  /**
   * Initialise all components
   *
   * Use the `data-module` attributes to find, instantiate and init all of the
   * components provided as part of GOV.UK Frontend.
   *
   * @param {Config & { scope?: Element }} [config] - Config for all components (with optional scope)
   */
  function initAll(config) {
    var _config$scope;
    config = typeof config !== 'undefined' ? config : {};
    if (!isSupported()) {
      console.log(new SupportError());
      return;
    }
    const components = [[Accordion, config.accordion], [Button, config.button], [CharacterCount, config.characterCount], [Checkboxes], [ErrorSummary, config.errorSummary], [ExitThisPage, config.exitThisPage], [Header], [NotificationBanner, config.notificationBanner], [Radios], [SkipLink], [Tabs]];
    const $scope = (_config$scope = config.scope) != null ? _config$scope : document;
    components.forEach(([Component, config]) => {
      const $elements = $scope.querySelectorAll(`[data-module="${Component.moduleName}"]`);
      $elements.forEach($element => {
        try {
          'defaults' in Component ? new Component($element, config) : new Component($element);
        } catch (error) {
          console.log(error);
        }
      });
    });
  }

  function getDefaultExportFromCjs (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  var accessibleAutocomplete_min = {exports: {}};

  (function (module, exports) {
  	(function webpackUniversalModuleDefinition(e,t){module.exports=t();})(window,function(){return function(n){var r={};function o(e){if(r[e])return r[e].exports;var t=r[e]={i:e,l:!1,exports:{}};return n[e].call(t.exports,t,t.exports,o),t.l=!0,t.exports}return o.m=n,o.c=r,o.d=function(e,t,n){o.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n});},o.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0});},o.t=function(t,e){if(1&e&&(t=o(t)),8&e)return t;if(4&e&&"object"==typeof t&&t&&t.__esModule)return t;var n=Object.create(null);if(o.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var r in t)o.d(n,r,function(e){return t[e]}.bind(null,r));return n},o.n=function(e){var t=e&&e.__esModule?function(){return e["default"]}:function(){return e};return o.d(t,"a",t),t},o.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},o.p="/",o(o.s=37)}([function(e,t,n){var m=n(1),v=n(6),y=n(7),g=n(16),_=n(18),b="prototype",w=function(e,t,n){var r,o,i,u,a=e&w.F,s=e&w.G,l=e&w.S,c=e&w.P,p=e&w.B,f=s?m:l?m[t]||(m[t]={}):(m[t]||{})[b],d=s?v:v[t]||(v[t]={}),h=d[b]||(d[b]={});for(r in s&&(n=t),n)i=((o=!a&&f&&f[r]!==undefined)?f:n)[r],u=p&&o?_(i,m):c&&"function"==typeof i?_(Function.call,i):i,f&&g(f,r,i,e&w.U),d[r]!=i&&y(d,r,u),c&&h[r]!=i&&(h[r]=i);};m.core=v,w.F=1,w.G=2,w.S=4,w.P=8,w.B=16,w.W=32,w.U=64,w.R=128,e.exports=w;},function(e,t){var n=e.exports="undefined"!=typeof window&&window.Math==Math?window:"undefined"!=typeof self&&self.Math==Math?self:Function("return this")();"number"==typeof __g&&(__g=n);},function(e,t){e.exports=function(e){return "object"==typeof e?null!==e:"function"==typeof e};},function(e,t,n){e.exports=!n(4)(function(){return 7!=Object.defineProperty({},"a",{get:function(){return 7}}).a});},function(e,t){e.exports=function(e){try{return !!e()}catch(t){return !0}};},function(e,t,n){n.r(t),n.d(t,"h",function(){return r}),n.d(t,"createElement",function(){return r}),n.d(t,"cloneElement",function(){return i}),n.d(t,"Component",function(){return g}),n.d(t,"render",function(){return _}),n.d(t,"rerender",function(){return f}),n.d(t,"options",function(){return E});var s=function s(){},E={},l=[],c=[];function r(e,t){var n,r,o,i,u=c;for(i=arguments.length;2<i--;)l.push(arguments[i]);for(t&&null!=t.children&&(l.length||l.push(t.children),delete t.children);l.length;)if((r=l.pop())&&r.pop!==undefined)for(i=r.length;i--;)l.push(r[i]);else "boolean"==typeof r&&(r=null),(o="function"!=typeof e)&&(null==r?r="":"number"==typeof r?r=String(r):"string"!=typeof r&&(o=!1)),o&&n?u[u.length-1]+=r:u===c?u=[r]:u.push(r),n=o;var a=new s;return a.nodeName=e,a.children=u,a.attributes=null==t?undefined:t,a.key=null==t?undefined:t.key,E.vnode!==undefined&&E.vnode(a),a}function M(e,t){for(var n in t)e[n]=t[n];return e}var o="function"==typeof Promise?Promise.resolve().then.bind(Promise.resolve()):setTimeout;function i(e,t){return r(e.nodeName,M(M({},e.attributes),t),2<arguments.length?[].slice.call(arguments,2):e.children)}var p=/acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i,u=[];function a(e){!e._dirty&&(e._dirty=!0)&&1==u.push(e)&&(E.debounceRendering||o)(f);}function f(){var e,t=u;for(u=[];e=t.pop();)e._dirty&&V(e);}function N(e,t){return e.normalizedNodeName===t||e.nodeName.toLowerCase()===t.toLowerCase()}function I(e){var t=M({},e.attributes);t.children=e.children;var n=e.nodeName.defaultProps;if(n!==undefined)for(var r in n)t[r]===undefined&&(t[r]=n[r]);return t}function k(e){var t=e.parentNode;t&&t.removeChild(e);}function v(e,t,n,r,o){if("className"===t&&(t="class"),"key"===t);else if("ref"===t)n&&n(null),r&&r(e);else if("class"!==t||o)if("style"===t){if(r&&"string"!=typeof r&&"string"!=typeof n||(e.style.cssText=r||""),r&&"object"==typeof r){if("string"!=typeof n)for(var i in n)i in r||(e.style[i]="");for(var i in r)e.style[i]="number"==typeof r[i]&&!1===p.test(i)?r[i]+"px":r[i];}}else if("dangerouslySetInnerHTML"===t)r&&(e.innerHTML=r.__html||"");else if("o"==t[0]&&"n"==t[1]){var u=t!==(t=t.replace(/Capture$/,""));t=t.toLowerCase().substring(2),r?n||e.addEventListener(t,d,u):e.removeEventListener(t,d,u),(e._listeners||(e._listeners={}))[t]=r;}else if("list"!==t&&"type"!==t&&!o&&t in e){try{e[t]=null==r?"":r;}catch(s){}null!=r&&!1!==r||"spellcheck"==t||e.removeAttribute(t);}else {var a=o&&t!==(t=t.replace(/^xlink:?/,""));null==r||!1===r?a?e.removeAttributeNS("http://www.w3.org/1999/xlink",t.toLowerCase()):e.removeAttribute(t):"function"!=typeof r&&(a?e.setAttributeNS("http://www.w3.org/1999/xlink",t.toLowerCase(),r):e.setAttribute(t,r));}else e.className=r||"";}function d(e){return this._listeners[e.type](E.event&&E.event(e)||e)}var A=[],P=0,j=!1,L=!1;function T(){for(var e;e=A.pop();)E.afterMount&&E.afterMount(e),e.componentDidMount&&e.componentDidMount();}function B(e,t,n,r,o,i){P++||(j=null!=o&&o.ownerSVGElement!==undefined,L=null!=e&&!("__preactattr_"in e));var u=D(e,t,n,r,i);return o&&u.parentNode!==o&&o.appendChild(u),--P||(L=!1,i||T()),u}function D(e,t,n,r,o){var i=e,u=j;if(null!=t&&"boolean"!=typeof t||(t=""),"string"==typeof t||"number"==typeof t)return e&&e.splitText!==undefined&&e.parentNode&&(!e._component||o)?e.nodeValue!=t&&(e.nodeValue=t):(i=document.createTextNode(t),e&&(e.parentNode&&e.parentNode.replaceChild(i,e),F(e,!0))),i["__preactattr_"]=!0,i;var a=t.nodeName;if("function"==typeof a)return function d(e,t,n,r){var o=e&&e._component,i=o,u=e,a=o&&e._componentConstructor===t.nodeName,s=a,l=I(t);for(;o&&!s&&(o=o._parentComponent);)s=o.constructor===t.nodeName;o&&s&&(!r||o._component)?(U(o,l,3,n,r),e=o.base):(i&&!a&&(q(i),e=u=null),o=R(t.nodeName,l,n),e&&!o.nextBase&&(o.nextBase=e,u=null),U(o,l,1,n,r),e=o.base,u&&e!==u&&(u._component=null,F(u,!1)));return e}(e,t,n,r);if(j="svg"===a||"foreignObject"!==a&&j,a=String(a),(!e||!N(e,a))&&(i=function h(e,t){var n=t?document.createElementNS("http://www.w3.org/2000/svg",e):document.createElement(e);return n.normalizedNodeName=e,n}(a,j),e)){for(;e.firstChild;)i.appendChild(e.firstChild);e.parentNode&&e.parentNode.replaceChild(i,e),F(e,!0);}var s=i.firstChild,l=i["__preactattr_"],c=t.children;if(null==l){l=i["__preactattr_"]={};for(var p=i.attributes,f=p.length;f--;)l[p[f].name]=p[f].value;}return !L&&c&&1===c.length&&"string"==typeof c[0]&&null!=s&&s.splitText!==undefined&&null==s.nextSibling?s.nodeValue!=c[0]&&(s.nodeValue=c[0]):(c&&c.length||null!=s)&&function S(e,t,n,r,o){var i,u,a,s,l,c=e.childNodes,p=[],f={},d=0,h=0,m=c.length,v=0,y=t?t.length:0;if(0!==m)for(var g=0;g<m;g++){var _=c[g],b=_["__preactattr_"],w=y&&b?_._component?_._component.__key:b.key:null;null!=w?(d++,f[w]=_):(b||(_.splitText!==undefined?!o||_.nodeValue.trim():o))&&(p[v++]=_);}if(0!==y)for(var g=0;g<y;g++){s=t[g],l=null;var w=s.key;if(null!=w)d&&f[w]!==undefined&&(l=f[w],f[w]=undefined,d--);else if(h<v)for(i=h;i<v;i++)if(p[i]!==undefined&&(x=u=p[i],C=o,"string"==typeof(O=s)||"number"==typeof O?x.splitText!==undefined:"string"==typeof O.nodeName?!x._componentConstructor&&N(x,O.nodeName):C||x._componentConstructor===O.nodeName)){l=u,p[i]=undefined,i===v-1&&v--,i===h&&h++;break}l=D(l,s,n,r),a=c[g],l&&l!==e&&l!==a&&(null==a?e.appendChild(l):l===a.nextSibling?k(a):e.insertBefore(l,a));}var x,O,C;if(d)for(var g in f)f[g]!==undefined&&F(f[g],!1);for(;h<=v;)(l=p[v--])!==undefined&&F(l,!1);}(i,c,n,r,L||null!=l.dangerouslySetInnerHTML),function m(e,t,n){var r;for(r in n)t&&null!=t[r]||null==n[r]||v(e,r,n[r],n[r]=undefined,j);for(r in t)"children"===r||"innerHTML"===r||r in n&&t[r]===("value"===r||"checked"===r?e[r]:n[r])||v(e,r,n[r],n[r]=t[r],j);}(i,t.attributes,l),j=u,i}function F(e,t){var n=e._component;n?q(n):(null!=e["__preactattr_"]&&e["__preactattr_"].ref&&e["__preactattr_"].ref(null),!1!==t&&null!=e["__preactattr_"]||k(e),h(e));}function h(e){for(e=e.lastChild;e;){var t=e.previousSibling;F(e,!0),e=t;}}var m=[];function R(e,t,n){var r,o=m.length;for(e.prototype&&e.prototype.render?(r=new e(t,n),g.call(r,t,n)):((r=new g(t,n)).constructor=e,r.render=y);o--;)if(m[o].constructor===e)return r.nextBase=m[o].nextBase,m.splice(o,1),r;return r}function y(e,t,n){return this.constructor(e,n)}function U(e,t,n,r,o){e._disable||(e._disable=!0,e.__ref=t.ref,e.__key=t.key,delete t.ref,delete t.key,"undefined"==typeof e.constructor.getDerivedStateFromProps&&(!e.base||o?e.componentWillMount&&e.componentWillMount():e.componentWillReceiveProps&&e.componentWillReceiveProps(t,r)),r&&r!==e.context&&(e.prevContext||(e.prevContext=e.context),e.context=r),e.prevProps||(e.prevProps=e.props),e.props=t,e._disable=!1,0!==n&&(1!==n&&!1===E.syncComponentUpdates&&e.base?a(e):V(e,1,o)),e.__ref&&e.__ref(e));}function V(e,t,n,r){if(!e._disable){var o,i,u,a=e.props,s=e.state,l=e.context,c=e.prevProps||a,p=e.prevState||s,f=e.prevContext||l,d=e.base,h=e.nextBase,m=d||h,v=e._component,y=!1,g=f;if(e.constructor.getDerivedStateFromProps&&(s=M(M({},s),e.constructor.getDerivedStateFromProps(a,s)),e.state=s),d&&(e.props=c,e.state=p,e.context=f,2!==t&&e.shouldComponentUpdate&&!1===e.shouldComponentUpdate(a,s,l)?y=!0:e.componentWillUpdate&&e.componentWillUpdate(a,s,l),e.props=a,e.state=s,e.context=l),e.prevProps=e.prevState=e.prevContext=e.nextBase=null,e._dirty=!1,!y){o=e.render(a,s,l),e.getChildContext&&(l=M(M({},l),e.getChildContext())),d&&e.getSnapshotBeforeUpdate&&(g=e.getSnapshotBeforeUpdate(c,p));var _,b,w=o&&o.nodeName;if("function"==typeof w){var x=I(o);(i=v)&&i.constructor===w&&x.key==i.__key?U(i,x,1,l,!1):(_=i,e._component=i=R(w,x,l),i.nextBase=i.nextBase||h,i._parentComponent=e,U(i,x,0,l,!1),V(i,1,n,!0)),b=i.base;}else u=m,(_=v)&&(u=e._component=null),(m||1===t)&&(u&&(u._component=null),b=function B(t,n,r,o,i,u){P++||(j=null!=i&&i.ownerSVGElement!==undefined,L=null!=t&&!("__preactattr_"in t));var a=D(t,n,r,o,u);return i&&a.parentNode!==i&&i.appendChild(a),--P||(L=!1,u||T()),a}(u,o,l,n||!d,m&&m.parentNode,!0));if(m&&b!==m&&i!==v){var O=m.parentNode;O&&b!==O&&(O.replaceChild(b,m),_||(m._component=null,F(m,!1)));}if(_&&q(_),(e.base=b)&&!r){for(var C=e,S=e;S=S._parentComponent;)(C=S).base=b;b._component=C,b._componentConstructor=C.constructor;}}for(!d||n?A.unshift(e):y||(e.componentDidUpdate&&e.componentDidUpdate(c,p,g),E.afterUpdate&&E.afterUpdate(e));e._renderCallbacks.length;)e._renderCallbacks.pop().call(e);P||r||T();}}function q(e){E.beforeUnmount&&E.beforeUnmount(e);var t=e.base;e._disable=!0,e.componentWillUnmount&&e.componentWillUnmount(),e.base=null;var n=e._component;n?q(n):t&&(t["__preactattr_"]&&t["__preactattr_"].ref&&t["__preactattr_"].ref(null),k(e.nextBase=t),m.push(e),h(t)),e.__ref&&e.__ref(null);}function g(e,t){this._dirty=!0,this.context=t,this.props=e,this.state=this.state||{},this._renderCallbacks=[];}function _(e,t,n){return B(n,e,{},!1,t,!1)}M(g.prototype,{setState:function(e,t){this.prevState||(this.prevState=this.state),this.state=M(M({},this.state),"function"==typeof e?e(this.state,this.props):e),t&&this._renderCallbacks.push(t),a(this);},forceUpdate:function(e){e&&this._renderCallbacks.push(e),V(this,2);},render:function _(){}});var b={h:r,createElement:r,cloneElement:i,Component:g,render:_,rerender:f,options:E};t["default"]=b;},function(e,t){var n=e.exports={version:"2.5.7"};"number"==typeof __e&&(__e=n);},function(e,t,n){var r=n(8),o=n(40);e.exports=n(3)?function(e,t,n){return r.f(e,t,o(1,n))}:function(e,t,n){return e[t]=n,e};},function(e,t,n){var o=n(9),i=n(38),u=n(39),a=Object.defineProperty;t.f=n(3)?Object.defineProperty:function(e,t,n){if(o(e),t=u(t,!0),o(n),i)try{return a(e,t,n)}catch(r){}if("get"in n||"set"in n)throw TypeError("Accessors not supported!");return "value"in n&&(e[t]=n.value),e};},function(e,t,n){var r=n(2);e.exports=function(e){if(!r(e))throw TypeError(e+" is not an object!");return e};},function(e,t){var n=0,r=Math.random();e.exports=function(e){return "Symbol(".concat(e===undefined?"":e,")_",(++n+r).toString(36))};},function(e,t,n){var r=n(22);e.exports=Object("z").propertyIsEnumerable(0)?Object:function(e){return "String"==r(e)?e.split(""):Object(e)};},function(e,t){e.exports=function(e){if(e==undefined)throw TypeError("Can't call method on  "+e);return e};},function(e,t,n){var r=n(4);e.exports=function(e,t){return !!e&&r(function(){t?e.call(null,function(){},1):e.call(null);})};},function(e,t,n){var r=n(0);r(r.S+r.F,"Object",{assign:n(41)});},function(e,t,n){var r=n(2),o=n(1).document,i=r(o)&&r(o.createElement);e.exports=function(e){return i?o.createElement(e):{}};},function(e,t,n){var i=n(1),u=n(7),a=n(17),s=n(10)("src"),r="toString",o=Function[r],l=(""+o).split(r);n(6).inspectSource=function(e){return o.call(e)},(e.exports=function(e,t,n,r){var o="function"==typeof n;o&&(a(n,"name")||u(n,"name",t)),e[t]!==n&&(o&&(a(n,s)||u(n,s,e[t]?""+e[t]:l.join(String(t)))),e===i?e[t]=n:r?e[t]?e[t]=n:u(e,t,n):(delete e[t],u(e,t,n)));})(Function.prototype,r,function(){return "function"==typeof this&&this[s]||o.call(this)});},function(e,t){var n={}.hasOwnProperty;e.exports=function(e,t){return n.call(e,t)};},function(e,t,n){var i=n(19);e.exports=function(r,o,e){if(i(r),o===undefined)return r;switch(e){case 1:return function(e){return r.call(o,e)};case 2:return function(e,t){return r.call(o,e,t)};case 3:return function(e,t,n){return r.call(o,e,t,n)}}return function(){return r.apply(o,arguments)}};},function(e,t){e.exports=function(e){if("function"!=typeof e)throw TypeError(e+" is not a function!");return e};},function(e,t,n){var r=n(42),o=n(28);e.exports=Object.keys||function(e){return r(e,o)};},function(e,t,n){var r=n(11),o=n(12);e.exports=function(e){return r(o(e))};},function(e,t){var n={}.toString;e.exports=function(e){return n.call(e).slice(8,-1)};},function(e,t,n){var s=n(21),l=n(24),c=n(43);e.exports=function(a){return function(e,t,n){var r,o=s(e),i=l(o.length),u=c(n,i);if(a&&t!=t){for(;u<i;)if((r=o[u++])!=r)return !0}else for(;u<i;u++)if((a||u in o)&&o[u]===t)return a||u||0;return !a&&-1}};},function(e,t,n){var r=n(25),o=Math.min;e.exports=function(e){return 0<e?o(r(e),9007199254740991):0};},function(e,t){var n=Math.ceil,r=Math.floor;e.exports=function(e){return isNaN(e=+e)?0:(0<e?r:n)(e)};},function(e,t,n){var r=n(27)("keys"),o=n(10);e.exports=function(e){return r[e]||(r[e]=o(e))};},function(e,t,n){var r=n(6),o=n(1),i="__core-js_shared__",u=o[i]||(o[i]={});(e.exports=function(e,t){return u[e]||(u[e]=t!==undefined?t:{})})("versions",[]).push({version:r.version,mode:n(44)?"pure":"global",copyright:"© 2018 Denis Pushkarev (zloirock.ru)"});},function(e,t){e.exports="constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf".split(",");},function(e,t,n){var r=n(12);e.exports=function(e){return Object(r(e))};},function(e,t,n){var r=n(8).f,o=Function.prototype,i=/^\s*function ([^ (]*)/;"name"in o||n(3)&&r(o,"name",{configurable:!0,get:function(){try{return (""+this).match(i)[1]}catch(e){return ""}}});},function(e,t,n){var r=n(0),o=n(32)(1);r(r.P+r.F*!n(13)([].map,!0),"Array",{map:function(e){return o(this,e,arguments[1])}});},function(e,t,n){var _=n(18),b=n(11),w=n(29),x=n(24),r=n(47);e.exports=function(p,e){var f=1==p,d=2==p,h=3==p,m=4==p,v=6==p,y=5==p||v,g=e||r;return function(e,t,n){for(var r,o,i=w(e),u=b(i),a=_(t,n,3),s=x(u.length),l=0,c=f?g(e,s):d?g(e,0):undefined;l<s;l++)if((y||l in u)&&(o=a(r=u[l],l,i),p))if(f)c[l]=o;else if(o)switch(p){case 3:return !0;case 5:return r;case 6:return l;case 2:c.push(r);}else if(m)return !1;return v?-1:h||m?m:c}};},function(e,t,n){var r=n(22);e.exports=Array.isArray||function(e){return "Array"==r(e)};},function(e,t,n){var r=n(27)("wks"),o=n(10),i=n(1).Symbol,u="function"==typeof i;(e.exports=function(e){return r[e]||(r[e]=u&&i[e]||(u?i:o)("Symbol."+e))}).store=r;},function(e,t,n){var r=n(0),o=n(23)(!1),i=[].indexOf,u=!!i&&1/[1].indexOf(1,-0)<0;r(r.P+r.F*(u||!n(13)(i)),"Array",{indexOf:function(e){return u?i.apply(this,arguments)||0:o(this,e,arguments[1])}});},function(e,t,n){var r=n(0);r(r.S,"Object",{create:n(52)});},function(e,t,n){t.__esModule=!0,t["default"]=void 0,n(14),n(30),n(31),n(35),n(49),n(50);var r=n(5),o=function s(e){return e&&e.__esModule?e:{"default":e}}(n(51));function i(e){if(!e.element)throw new Error("element is not defined");if(!e.id)throw new Error("id is not defined");if(!e.source)throw new Error("source is not defined");Array.isArray(e.source)&&(e.source=u(e.source)),(0, r.render)((0, r.createElement)(o["default"],e),e.element);}var u=function u(n){return function(t,e){e(n.filter(function(e){return -1!==e.toLowerCase().indexOf(t.toLowerCase())}));}};i.enhanceSelectElement=function(n){if(!n.selectElement)throw new Error("selectElement is not defined");if(!n.source){var e=[].filter.call(n.selectElement.options,function(e){return e.value||n.preserveNullOptions});n.source=e.map(function(e){return e.textContent||e.innerText});}if(n.onConfirm=n.onConfirm||function(t){var e=[].filter.call(n.selectElement.options,function(e){return (e.textContent||e.innerText)===t})[0];e&&(e.selected=!0);},n.selectElement.value||n.defaultValue===undefined){var t=n.selectElement.options[n.selectElement.options.selectedIndex];n.defaultValue=t.textContent||t.innerText;}n.name===undefined&&(n.name=""),n.id===undefined&&(n.selectElement.id===undefined?n.id="":n.id=n.selectElement.id),n.autoselect===undefined&&(n.autoselect=!0);var r=document.createElement("div");n.selectElement.parentNode.insertBefore(r,n.selectElement),i(Object.assign({},n,{element:r})),n.selectElement.style.display="none",n.selectElement.id=n.selectElement.id+"-select";};var a=i;t["default"]=a;},function(e,t,n){e.exports=!n(3)&&!n(4)(function(){return 7!=Object.defineProperty(n(15)("div"),"a",{get:function(){return 7}}).a});},function(e,t,n){var o=n(2);e.exports=function(e,t){if(!o(e))return e;var n,r;if(t&&"function"==typeof(n=e.toString)&&!o(r=n.call(e)))return r;if("function"==typeof(n=e.valueOf)&&!o(r=n.call(e)))return r;if(!t&&"function"==typeof(n=e.toString)&&!o(r=n.call(e)))return r;throw TypeError("Can't convert object to primitive value")};},function(e,t){e.exports=function(e,t){return {enumerable:!(1&e),configurable:!(2&e),writable:!(4&e),value:t}};},function(e,t,n){var f=n(20),d=n(45),h=n(46),m=n(29),v=n(11),o=Object.assign;e.exports=!o||n(4)(function(){var e={},t={},n=Symbol(),r="abcdefghijklmnopqrst";return e[n]=7,r.split("").forEach(function(e){t[e]=e;}),7!=o({},e)[n]||Object.keys(o({},t)).join("")!=r})?function(e,t){for(var n=m(e),r=arguments.length,o=1,i=d.f,u=h.f;o<r;)for(var a,s=v(arguments[o++]),l=i?f(s).concat(i(s)):f(s),c=l.length,p=0;p<c;)u.call(s,a=l[p++])&&(n[a]=s[a]);return n}:o;},function(e,t,n){var u=n(17),a=n(21),s=n(23)(!1),l=n(26)("IE_PROTO");e.exports=function(e,t){var n,r=a(e),o=0,i=[];for(n in r)n!=l&&u(r,n)&&i.push(n);for(;t.length>o;)u(r,n=t[o++])&&(~s(i,n)||i.push(n));return i};},function(e,t,n){var r=n(25),o=Math.max,i=Math.min;e.exports=function(e,t){return (e=r(e))<0?o(e+t,0):i(e,t)};},function(e,t){e.exports=!1;},function(e,t){t.f=Object.getOwnPropertySymbols;},function(e,t){t.f={}.propertyIsEnumerable;},function(e,t,n){var r=n(48);e.exports=function(e,t){return new(r(e))(t)};},function(e,t,n){var r=n(2),o=n(33),i=n(34)("species");e.exports=function(e){var t;return o(e)&&("function"!=typeof(t=e.constructor)||t!==Array&&!o(t.prototype)||(t=undefined),r(t)&&null===(t=t[i])&&(t=undefined)),t===undefined?Array:t};},function(e,t,n){var r=n(0),o=n(32)(2);r(r.P+r.F*!n(13)([].filter,!0),"Array",{filter:function(e){return o(this,e,arguments[1])}});},function(e,t,n){var r=n(0);r(r.S,"Array",{isArray:n(33)});},function(e,t,n){t.__esModule=!0,t["default"]=void 0,n(14),n(36),n(30),n(31),n(35),n(55),n(58);var $=n(5),J=o(n(60)),r=o(n(61));function o(e){return e&&e.__esModule?e:{"default":e}}function X(){return (X=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r]);}return e}).apply(this,arguments)}function i(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}var u={13:"enter",27:"escape",32:"space",38:"up",40:"down"};function Y(){return "undefined"!=typeof navigator&&!(!navigator.userAgent.match(/(iPod|iPhone|iPad)/g)||!navigator.userAgent.match(/AppleWebKit/g))}var a=function(n){function e(e){var t;return (t=n.call(this,e)||this).elementReferences={},t.state={focused:null,hovered:null,menuOpen:!1,options:e.defaultValue?[e.defaultValue]:[],query:e.defaultValue,validChoiceMade:!1,selected:null,ariaHint:!0},t.handleComponentBlur=t.handleComponentBlur.bind(i(i(t))),t.handleKeyDown=t.handleKeyDown.bind(i(i(t))),t.handleUpArrow=t.handleUpArrow.bind(i(i(t))),t.handleDownArrow=t.handleDownArrow.bind(i(i(t))),t.handleEnter=t.handleEnter.bind(i(i(t))),t.handlePrintableKey=t.handlePrintableKey.bind(i(i(t))),t.handleListMouseLeave=t.handleListMouseLeave.bind(i(i(t))),t.handleOptionBlur=t.handleOptionBlur.bind(i(i(t))),t.handleOptionClick=t.handleOptionClick.bind(i(i(t))),t.handleOptionFocus=t.handleOptionFocus.bind(i(i(t))),t.handleOptionMouseDown=t.handleOptionMouseDown.bind(i(i(t))),t.handleOptionMouseEnter=t.handleOptionMouseEnter.bind(i(i(t))),t.handleInputBlur=t.handleInputBlur.bind(i(i(t))),t.handleInputChange=t.handleInputChange.bind(i(i(t))),t.handleInputFocus=t.handleInputFocus.bind(i(i(t))),t.pollInputElement=t.pollInputElement.bind(i(i(t))),t.getDirectInputChanges=t.getDirectInputChanges.bind(i(i(t))),t}(function r(e,t){e.prototype=Object.create(t.prototype),(e.prototype.constructor=e).__proto__=t;})(e,n);var t=e.prototype;return t.isQueryAnOption=function(e,t){var n=this;return -1!==t.map(function(e){return n.templateInputValue(e).toLowerCase()}).indexOf(e.toLowerCase())},t.componentDidMount=function(){this.pollInputElement();},t.componentWillUnmount=function(){clearTimeout(this.$pollInput);},t.pollInputElement=function(){var e=this;this.getDirectInputChanges(),this.$pollInput=setTimeout(function(){e.pollInputElement();},100);},t.getDirectInputChanges=function(){var e=this.elementReferences[-1];e&&e.value!==this.state.query&&this.handleInputChange({target:{value:e.value}});},t.componentDidUpdate=function(e,t){var n=this.state.focused,r=null===n,o=t.focused!==n;o&&!r&&this.elementReferences[n].focus();var i=-1===n,u=o&&null===t.focused;if(i&&u){var a=this.elementReferences[n];a.setSelectionRange(0,a.value.length);}},t.hasAutoselect=function(){return !Y()&&this.props.autoselect},t.templateInputValue=function(e){var t=this.props.templates&&this.props.templates.inputValue;return t?t(e):e},t.templateSuggestion=function(e){var t=this.props.templates&&this.props.templates.suggestion;return t?t(e):e},t.handleComponentBlur=function(e){var t,n=this.state,r=n.options,o=n.query,i=n.selected;this.props.confirmOnBlur?(t=e.query||o,this.props.onConfirm(r[i])):t=o,this.setState({focused:null,menuOpen:e.menuOpen||!1,query:t,selected:null,validChoiceMade:this.isQueryAnOption(t,r)});},t.handleListMouseLeave=function(e){this.setState({hovered:null});},t.handleOptionBlur=function(e,t){var n=this.state,r=n.focused,o=n.menuOpen,i=n.options,u=n.selected,a=null===e.relatedTarget,s=e.relatedTarget===this.elementReferences[-1],l=r!==t&&-1!==r;if(!l&&a||!(l||s)){var c=o&&Y();this.handleComponentBlur({menuOpen:c,query:this.templateInputValue(i[u])});}},t.handleInputBlur=function(e){var t=this.state,n=t.focused,r=t.menuOpen,o=t.options,i=t.query,u=t.selected;if(!(-1!==n)){var a=r&&Y(),s=Y()?i:this.templateInputValue(o[u]);this.handleComponentBlur({menuOpen:a,query:s});}},t.handleInputChange=function(e){var n=this,t=this.props,r=t.minLength,o=t.source,i=t.showAllValues,u=this.hasAutoselect(),a=e.target.value,s=0===a.length,l=this.state.query.length!==a.length,c=a.length>=r;this.setState({query:a,ariaHint:s}),i||!s&&l&&c?o(a,function(e){var t=0<e.length;n.setState({menuOpen:t,options:e,selected:u&&t?0:-1,validChoiceMade:!1});}):!s&&c||this.setState({menuOpen:!1,options:[]});},t.handleInputClick=function(e){this.handleInputChange(e);},t.handleInputFocus=function(e){var t=this.state,n=t.query,r=t.validChoiceMade,o=t.options,i=this.props.minLength,u=!r&&n.length>=i&&0<o.length;u?this.setState(function(e){var t=e.menuOpen;return {focused:-1,menuOpen:u||t,selected:-1}}):this.setState({focused:-1});},t.handleOptionFocus=function(e){this.setState({focused:e,hovered:null,selected:e});},t.handleOptionMouseEnter=function(e,t){Y()||this.setState({hovered:t});},t.handleOptionClick=function(e,t){var n=this.state.options[t],r=this.templateInputValue(n);this.props.onConfirm(n),this.setState({focused:-1,hovered:null,menuOpen:!1,query:r,selected:-1,validChoiceMade:!0}),this.forceUpdate();},t.handleOptionMouseDown=function(e){e.preventDefault();},t.handleUpArrow=function(e){e.preventDefault();var t=this.state,n=t.menuOpen,r=t.selected;-1!==r&&n&&this.handleOptionFocus(r-1);},t.handleDownArrow=function(e){var t=this;if(e.preventDefault(),this.props.showAllValues&&!1===this.state.menuOpen)e.preventDefault(),this.props.source("",function(e){t.setState({menuOpen:!0,options:e,selected:0,focused:0,hovered:null});});else if(!0===this.state.menuOpen){var n=this.state,r=n.menuOpen,o=n.options,i=n.selected;i!==o.length-1&&r&&this.handleOptionFocus(i+1);}},t.handleSpace=function(e){var t=this;this.props.showAllValues&&!1===this.state.menuOpen&&""===this.state.query&&(e.preventDefault(),this.props.source("",function(e){t.setState({menuOpen:!0,options:e});})),-1!==this.state.focused&&(e.preventDefault(),this.handleOptionClick(e,this.state.focused));},t.handleEnter=function(e){this.state.menuOpen&&(e.preventDefault(),0<=this.state.selected&&this.handleOptionClick(e,this.state.selected));},t.handlePrintableKey=function(e){var t=this.elementReferences[-1];e.target===t||t.focus();},t.handleKeyDown=function(e){switch(u[e.keyCode]){case"up":this.handleUpArrow(e);break;case"down":this.handleDownArrow(e);break;case"space":this.handleSpace(e);break;case"enter":this.handleEnter(e);break;case"escape":this.handleComponentBlur({query:this.state.query});break;default:(function t(e){return 47<e&&e<58||32===e||8===e||64<e&&e<91||95<e&&e<112||185<e&&e<193||218<e&&e<223})(e.keyCode)&&this.handlePrintableKey(e);}},t.render=function(){var e,i=this,t=this.props,n=t.cssNamespace,r=t.displayMenu,u=t.id,o=t.minLength,a=t.name,s=t.placeholder,l=t.required,c=t.showAllValues,p=t.tNoResults,f=t.tStatusQueryTooShort,d=t.tStatusNoResults,h=t.tStatusSelectedOption,m=t.tStatusResults,v=t.tAssistiveHint,y=t.dropdownArrow,g=this.state,_=g.focused,b=g.hovered,w=g.menuOpen,x=g.options,O=g.query,C=g.selected,S=g.ariaHint,E=g.validChoiceMade,M=this.hasAutoselect(),N=-1===_,I=0===x.length,k=0!==O.length,A=O.length>=o,P=this.props.showNoOptionsFound&&N&&I&&k&&A,j=n+"__wrapper",L=n+"__input",T=null!==_?" "+L+"--focused":"",B=this.props.showAllValues?" "+L+"--show-all-values":" "+L+"--default",D=n+"__dropdown-arrow-down",F=-1!==_&&null!==_,R=n+"__menu",U=R+"--"+r,V=R+"--"+(w||P?"visible":"hidden"),q=n+"__option",W=n+"__hint",H=this.templateInputValue(x[C]),K=H&&0===H.toLowerCase().indexOf(O.toLowerCase())&&M?O+H.substr(O.length):"",Q=u+"__assistiveHint",z=S?{"aria-describedby":Q}:null;return c&&"string"==typeof(e=y({className:D}))&&(e=(0, $.createElement)("div",{className:n+"__dropdown-arrow-down-wrapper",dangerouslySetInnerHTML:{__html:e}})),(0, $.createElement)("div",{className:j,onKeyDown:this.handleKeyDown},(0, $.createElement)(J["default"],{id:u,length:x.length,queryLength:O.length,minQueryLength:o,selectedOption:this.templateInputValue(x[C]),selectedOptionIndex:C,validChoiceMade:E,isInFocus:null!==this.state.focused,tQueryTooShort:f,tNoResults:d,tSelectedOption:h,tResults:m}),K&&(0, $.createElement)("span",null,(0, $.createElement)("input",{className:W,readonly:!0,tabIndex:"-1",value:K})),(0, $.createElement)("input",X({"aria-expanded":w?"true":"false","aria-activedescendant":!!F&&u+"__option--"+_,"aria-owns":u+"__listbox","aria-autocomplete":this.hasAutoselect()?"both":"list"},z,{autoComplete:"off",className:""+L+T+B,id:u,onClick:function(e){return i.handleInputClick(e)},onBlur:this.handleInputBlur},function G(e){return {onInput:e}}(this.handleInputChange),{onFocus:this.handleInputFocus,name:a,placeholder:s,ref:function(e){i.elementReferences[-1]=e;},type:"text",role:"combobox",required:l,value:O})),e,(0, $.createElement)("ul",{className:R+" "+U+" "+V,onMouseLeave:function(e){return i.handleListMouseLeave(e)},id:u+"__listbox",role:"listbox"},x.map(function(e,t){var n=(-1===_?C===t:_===t)&&null===b?" "+q+"--focused":"",r=t%2?" "+q+"--odd":"",o=Y()?"<span id="+u+"__option-suffix--"+t+' style="border:0;clip:rect(0 0 0 0);height:1px;marginBottom:-1px;marginRight:-1px;overflow:hidden;padding:0;position:absolute;whiteSpace:nowrap;width:1px"> '+(t+1)+" of "+x.length+"</span>":"";return (0, $.createElement)("li",{"aria-selected":_===t?"true":"false",className:""+q+n+r,dangerouslySetInnerHTML:{__html:i.templateSuggestion(e)+o},id:u+"__option--"+t,key:t,onBlur:function(e){return i.handleOptionBlur(e,t)},onClick:function(e){return i.handleOptionClick(e,t)},onMouseDown:i.handleOptionMouseDown,onMouseEnter:function(e){return i.handleOptionMouseEnter(e,t)},ref:function(e){i.elementReferences[t]=e;},role:"option",tabIndex:"-1","aria-posinset":t+1,"aria-setsize":x.length})}),P&&(0, $.createElement)("li",{className:q+" "+q+"--no-results"},p())),(0, $.createElement)("span",{id:Q,style:{display:"none"}},v()))},e}($.Component);(t["default"]=a).defaultProps={autoselect:!1,cssNamespace:"autocomplete",defaultValue:"",displayMenu:"inline",minLength:0,name:"input-autocomplete",placeholder:"",onConfirm:function(){},confirmOnBlur:!0,showNoOptionsFound:!0,showAllValues:!1,required:!1,tNoResults:function(){return "No results found"},tAssistiveHint:function(){return "When autocomplete results are available use up and down arrows to review and enter to select.  Touch device users, explore by touch or with swipe gestures."},dropdownArrow:r["default"]};},function(e,t,r){var o=r(9),i=r(53),u=r(28),a=r(26)("IE_PROTO"),s=function(){},l="prototype",c=function(){var e,t=r(15)("iframe"),n=u.length;for(t.style.display="none",r(54).appendChild(t),t.src="javascript:",(e=t.contentWindow.document).open(),e.write("<script>document.F=Object<\/script>"),e.close(),c=e.F;n--;)delete c[l][u[n]];return c()};e.exports=Object.create||function(e,t){var n;return null!==e?(s[l]=o(e),n=new s,s[l]=null,n[a]=e):n=c(),t===undefined?n:i(n,t)};},function(e,t,n){var u=n(8),a=n(9),s=n(20);e.exports=n(3)?Object.defineProperties:function(e,t){a(e);for(var n,r=s(t),o=r.length,i=0;i<o;)u.f(e,n=r[i++],t[n]);return e};},function(e,t,n){var r=n(1).document;e.exports=r&&r.documentElement;},function(e,t,n){var r=n(0);r(r.P,"Function",{bind:n(56)});},function(e,t,n){var i=n(19),u=n(2),a=n(57),s=[].slice,l={};e.exports=Function.bind||function(t){var n=i(this),r=s.call(arguments,1),o=function(){var e=r.concat(s.call(arguments));return this instanceof o?function(e,t,n){if(!(t in l)){for(var r=[],o=0;o<t;o++)r[o]="a["+o+"]";l[t]=Function("F,a","return new F("+r.join(",")+")");}return l[t](e,n)}(n,e.length,e):a(n,e,t)};return u(n.prototype)&&(o.prototype=n.prototype),o};},function(e,t){e.exports=function(e,t,n){var r=n===undefined;switch(t.length){case 0:return r?e():e.call(n);case 1:return r?e(t[0]):e.call(n,t[0]);case 2:return r?e(t[0],t[1]):e.call(n,t[0],t[1]);case 3:return r?e(t[0],t[1],t[2]):e.call(n,t[0],t[1],t[2]);case 4:return r?e(t[0],t[1],t[2],t[3]):e.call(n,t[0],t[1],t[2],t[3])}return e.apply(n,t)};},function(e,t,n){n(59)("match",1,function(r,o,e){return [function(e){var t=r(this),n=e==undefined?undefined:e[o];return n!==undefined?n.call(e,t):new RegExp(e)[o](String(t))},e]});},function(e,t,n){var a=n(7),s=n(16),l=n(4),c=n(12),p=n(34);e.exports=function(t,e,n){var r=p(t),o=n(c,r,""[t]),i=o[0],u=o[1];l(function(){var e={};return e[r]=function(){return 7},7!=""[t](e)})&&(s(String.prototype,t,i),a(RegExp.prototype,r,2==e?function(e,t){return u.call(e,this,t)}:function(e){return u.call(e,this)}));};},function(e,t,n){t.__esModule=!0,t["default"]=void 0,n(36);var _=n(5);var r=function r(o,i,u){var a;return function(){var e=this,t=arguments,n=function n(){a=null,u||o.apply(e,t);},r=u&&!a;clearTimeout(a),a=setTimeout(n,i),r&&o.apply(e,t);}},o=function(o){function e(){for(var e,t=arguments.length,n=new Array(t),r=0;r<t;r++)n[r]=arguments[r];return (e=o.call.apply(o,[this].concat(n))||this).state={bump:!1,debounced:!1},e}(function n(e,t){e.prototype=Object.create(t.prototype),(e.prototype.constructor=e).__proto__=t;})(e,o);var t=e.prototype;return t.componentWillMount=function(){var e=this;this.debounceStatusUpdate=r(function(){if(!e.state.debounced){var t=!e.props.isInFocus||e.props.validChoiceMade;e.setState(function(e){return {bump:!e.bump,debounced:!0,silenced:t}});}},1400);},t.componentWillReceiveProps=function(e){e.queryLength;this.setState({debounced:!1});},t.render=function(){var e=this.props,t=e.id,n=e.length,r=e.queryLength,o=e.minQueryLength,i=e.selectedOption,u=e.selectedOptionIndex,a=e.tQueryTooShort,s=e.tNoResults,l=e.tSelectedOption,c=e.tResults,p=this.state,f=p.bump,d=p.debounced,h=p.silenced,m=r<o,v=0===n,y=i?l(i,n,u):"",g=null;return g=m?a(o):v?s():c(n,y),this.debounceStatusUpdate(),(0, _.createElement)("div",{style:{border:"0",clip:"rect(0 0 0 0)",height:"1px",marginBottom:"-1px",marginRight:"-1px",overflow:"hidden",padding:"0",position:"absolute",whiteSpace:"nowrap",width:"1px"}},(0, _.createElement)("div",{id:t+"__status--A",role:"status","aria-atomic":"true","aria-live":"polite"},!h&&d&&f?g:""),(0, _.createElement)("div",{id:t+"__status--B",role:"status","aria-atomic":"true","aria-live":"polite"},h||!d||f?"":g))},e}(_.Component);(t["default"]=o).defaultProps={tQueryTooShort:function(e){return "Type in "+e+" or more characters for results"},tNoResults:function(){return "No search results"},tSelectedOption:function(e,t,n){return e+" "+(n+1)+" of "+t+" is highlighted"},tResults:function(e,t){return e+" "+(1===e?"result":"results")+" "+(1===e?"is":"are")+" available. "+t}};},function(e,t,n){t.__esModule=!0,t["default"]=void 0;var r=n(5),o=function i(e){var t=e.className;return (0, r.createElement)("svg",{version:"1.1",xmlns:"http://www.w3.org/2000/svg",className:t,focusable:"false"},(0, r.createElement)("g",{stroke:"none",fill:"none","fill-rule":"evenodd"},(0, r.createElement)("polygon",{fill:"#000000",points:"0 0 22 0 11 17"})))};t["default"]=o;}])["default"]});
  	
  } (accessibleAutocomplete_min));

  var accessibleAutocomplete_minExports = accessibleAutocomplete_min.exports;
  var accessibleAutocomplete = /*@__PURE__*/getDefaultExportFromCjs(accessibleAutocomplete_minExports);

  class SiteSearchElement extends HTMLElement {
    constructor() {
      super();

      this.statusMessage = null;
      this.searchInputId = 'app-site-search__input';
      this.searchIndex = null;
      this.searchIndexUrl = this.getAttribute('index');
      this.searchLabel = this.getAttribute('label');
      this.searchResults = [];
      this.searchTimeout = 10;
      this.sitemapLink = this.querySelector('.app-site-search__link');
    }

    async fetchSearchIndex(indexUrl) {
      this.statusMessage = 'Loading search index';

      try {
        const response = await fetch(indexUrl, {
          signal: AbortSignal.timeout(this.searchTimeout * 1000)
        });

        if (!response.ok) {
          throw Error('Search index not found')
        }

        const json = await response.json();
        this.statusMessage = 'No results found';
        this.searchIndex = json;
      } catch (error) {
        this.statusMessage = 'Failed to load search index';
        console.error(this.statusMessage, error.message);
      }
    }

    findResults(searchQuery, searchIndex) {
      return searchIndex.filter((item) => {
        const regex = new RegExp(searchQuery, 'gi');
        return item.title.match(regex) || item.templateContent.match(regex)
      })
    }

    renderResults(query, populateResults) {
      if (!this.searchIndex) {
        return populateResults(this.searchResults)
      }

      this.searchResults = this.findResults(query, this.searchIndex).reverse();

      populateResults(this.searchResults);
    }

    handleOnConfirm(result) {
      const path = result.url;
      if (!path) {
        return
      }

      window.location.href = path;
    }

    handleNoResults() {
      return this.statusMessage
    }

    inputValueTemplate(result) {
      if (result) {
        return result.title
      }
    }

    searchTemplate() {
      const labelElement = document.createElement('label');
      labelElement.classList.add('govuk-visually-hidden');
      labelElement.htmlFor = this.searchInputId;
      labelElement.textContent = this.searchLabel;

      const searchElement = document.createElement('search');
      searchElement.append(labelElement);

      return searchElement
    }

    resultTemplate(result) {
      if (result) {
        const element = document.createElement('span');
        element.textContent = result.title;

        if (result.hasFrontmatterDate || result.section) {
          const section = document.createElement('span');
          section.className = 'app-site-search--section';

          section.innerHTML =
            result.hasFrontmatterDate && result.section
              ? `${result.section}<br>${result.date}`
              : result.section || result.date;

          element.appendChild(section);
        }

        return element.innerHTML
      }
    }

    async connectedCallback() {
      await this.fetchSearchIndex(this.searchIndexUrl);

      // Remove fallback link to sitemap
      if (this.sitemapLink) {
        this.sitemapLink.remove();
      }

      // Add `search` element with `label`
      const search = this.searchTemplate();
      this.append(search);

      accessibleAutocomplete({
        element: search,
        id: this.searchInputId,
        cssNamespace: 'app-site-search',
        displayMenu: 'overlay',
        minLength: 2,
        placeholder: this.searchLabel,
        confirmOnBlur: false,
        autoselect: true,
        source: this.renderResults.bind(this),
        onConfirm: this.handleOnConfirm,
        templates: {
          inputValue: this.inputValueTemplate,
          suggestion: this.resultTemplate
        },
        tNoResults: this.handleNoResults.bind(this)
      });
    }
  }

  // Initiate custom elements
  customElements.define('site-search', SiteSearchElement);

  // Initiate scripts on page load
  document.addEventListener('DOMContentLoaded', () => {
    initAll();
  });

})();
