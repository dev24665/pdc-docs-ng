/*
 * searchtools.js
 * ~~~~~~~~~~~~~~~~
 *
 * Sphinx JavaScript utilities for the full-text search.
 *
 * :copyright: Copyright 2007-2024 by the Sphinx team, see AUTHORS.
 * :license: BSD, see LICENSE for details.
 *
 */
"use strict";

/**
 * Simple result scoring code.
 */
console.log(Search1);
if (typeof Scorer === "undefined") {
  console.log("inside Scorer");
  var Scorer = {
    // Implement the following function to further tweak the score for each result
    // The function takes a result array [docname, title, anchor, descr, score, filename]
    // and returns the new score.
    /*
    score: result => {
      const [docname, title, anchor, descr, score, filename] = result
      return score
    },
    */

    // query matches the full name of an object
    objNameMatch: 11,
    // or matches in the last dotted part of the object name
    objPartialMatch: 6,
    // Additive scores depending on the priority of the object
    objPrio: {
      0: 15, // used to be importantResults
      1: 5, // used to be objectResults
      2: -5, // used to be unimportantResults
    },
    //  Used when the priority is not in the mapping.
    objPrioDefault: 0,

    // query found in title
    title: 15,
    partialTitle: 7,
    // query found in terms
    term: 5,
    partialTerm: 2,
  };
}

const _removeChildren = (element) => {
  while (element && element.lastChild) element.removeChild(element.lastChild);
};


/**
 * See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
 */

const _escapeRegExp = (string) =>
  string.replace(/[.*+\-?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string

const _displayItem = (item, searchTerms, highlightTerms) => {
  console.log("inside _displayItem");
  const docBuilder = DOCUMENTATION_OPTIONS.BUILDER;
  const docFileSuffix = DOCUMENTATION_OPTIONS.FILE_SUFFIX;
  const docLinkSuffix = DOCUMENTATION_OPTIONS.LINK_SUFFIX;
  const showSearchSummary = DOCUMENTATION_OPTIONS.SHOW_SEARCH_SUMMARY;
  const contentRoot = document.documentElement.dataset.content_root;
  console.log(item);

  const [docName, title, anchor, descr, score, _filename] = item;

  let listItem = document.createElement("li");
  let requestUrl;
  let linkUrl;
  if (docBuilder === "dirhtml") {
    // dirhtml builder
    let dirname = docName + "/";
    //let dirname = "";
    if (dirname.match(/\/index\/$/))
      dirname = dirname.substring(0, dirname.length - 6);
    else if (dirname === "index/") dirname = "";
    requestUrl = contentRoot + dirname;
    linkUrl = requestUrl;
  } else {
    // normal html builders
    //requestUrl = contentRoot + docName + docFileSuffix;
    requestUrl = docFileSuffix;
    linkUrl = docName + docLinkSuffix;
  }
  let linkEl = listItem.appendChild(document.createElement("a"));

  linkEl.href = linkUrl + anchor;
  linkEl.dataset.score = score;
  linkEl.innerHTML = title;
  if (descr) {
    listItem.appendChild(document.createElement("span")).innerHTML =
      " (" + descr + ")";
    // highlight search terms in the description
    if (SPHINX_HIGHLIGHT_ENABLED)  // set in sphinx_highlight.js
      highlightTerms.forEach((term) => _highlightText(listItem, term, "highlighted"));
  }
  else if (showSearchSummary)
    fetch(requestUrl)
      .then((responseData) => responseData.text())
      .then((data) => {
        if (data)
          listItem.appendChild(
            Search.makeSearchSummary(data, searchTerms, anchor)
          );
        // highlight search terms in the summary
        if (SPHINX_HIGHLIGHT_ENABLED)  // set in sphinx_highlight.js
          highlightTerms.forEach((term) => _highlightText(listItem, term, "highlighted"));
      });
  Search.output.appendChild(listItem);
};
const _finishSearch = (resultCount) => {
  Search.stopPulse();
  Search.title.innerText = _("Search Results");
  if (!resultCount)
    Search.status.innerText = Documentation.gettext(
      "Your search did not match any documents. Please make sure that all words are spelled correctly and that you've selected enough categories."
    );
  else
    Search.status.innerText = _(
      "Search finished, found ${resultCount} page(s) matching the search query."
    ).replace('${resultCount}', resultCount);
};
const _displayNextItem = (
  results,
  resultCount,
  searchTerms,
  highlightTerms,
) => {
  // results left, load the summary and display it
  // this is intended to be dynamic (don't sub resultsCount)
  if (results.length) {
    _displayItem(results.pop(), searchTerms, highlightTerms);
    setTimeout(
      () => _displayNextItem(results, resultCount, searchTerms, highlightTerms),
      5
    );
  }
  // search finished, update title and status message
  else _finishSearch(resultCount);
};
// Helper function used by query() to order search results.
// Each input is an array of [docname, title, anchor, descr, score, filename].
// Order the results by score (in opposite order of appearance, since the
// `_displayNextItem` function uses pop() to retrieve items) and then alphabetically.
const _orderResultsByScoreThenName = (a, b) => {
  const leftScore = a[4];
  const rightScore = b[4];
  if (leftScore === rightScore) {
    // same score: sort alphabetically
    const leftTitle = a[1].toLowerCase();
    const rightTitle = b[1].toLowerCase();
    if (leftTitle === rightTitle) return 0;
    return leftTitle > rightTitle ? -1 : 1; // inverted is intentional
  }
  return leftScore > rightScore ? 1 : -1;
};

/**
 * Default splitQuery function. Can be overridden in ``sphinx.search`` with a
 * custom function per language.
 *
 * The regular expression works by splitting the string on consecutive characters
 * that are not Unicode letters, numbers, underscores, or emoji characters.
 * This is the same as ``\W+`` in Python, preserving the surrogate pair area.
 */
if (typeof splitQuery === "undefined") {
  var splitQuery = (query) => query
      .split(/[^\p{Letter}\p{Number}_\p{Emoji_Presentation}]+/gu)
      .filter(term => term)  // remove remaining empty strings
}

/**
 * Search Module
 */
if (typeof Search === "undefined") {
  console.log("inside Search");
  console.log(Search1);
var Search  = {
  _index: null,
  _queued_query: null,
  _pulse_status: -1,


  htmlToText: (htmlString, anchor) => {
    const htmlElement = new DOMParser().parseFromString(htmlString, 'text/html');
    for (const removalQuery of [".headerlink", "script", "style"]) {
      htmlElement.querySelectorAll(removalQuery).forEach((el) => { el.remove() });
    }
    if (anchor) {
      const anchorContent = htmlElement.querySelector(`[role="main"] ${anchor}`);
      if (anchorContent) return anchorContent.textContent;

      console.warn(
        `Anchored content block not found. Sphinx search tries to obtain it via DOM query '[role=main] ${anchor}'. Check your theme or template.`
      );
    }

    // if anchor not specified or not found, fall back to main content
    const docContent = htmlElement.querySelector('[role="main"]');
    if (docContent) return docContent.textContent;

    console.warn(
      "Content block not found. Sphinx search tries to obtain it via DOM query '[role=main]'. Check your theme or template."
    );
    return "";
  },

  init: () => {
    console.log("inside init");
    const query = new URLSearchParams(window.location.search).get("q");
    console.log("query",query);
  
    document
      .querySelectorAll('input[name="q"]')
      .forEach((el) => (el.value = query));
    if (query) Search.performSearch(query);
  },

  loadIndex: (url) =>
    (document.body.appendChild(document.createElement("script")).src = url),

  setIndex: (index) => {
    console.log("inside setIndex");
    console.log("index", index);
    Search._index = Search1._index;
    if (Search._queued_query !== null) {
      const query = Search._queued_query;
      Search._queued_query = null;
      Search.query(query);
    }
  },

  hasIndex: () => Search1._index !== null,

  deferQuery: (query) => (Search._queued_query = query),

  stopPulse: () => (Search._pulse_status = -1),

  startPulse: () => {
    if (Search._pulse_status >= 0) return;

    const pulse = () => {
      Search._pulse_status = (Search._pulse_status + 1) % 4;
      Search.dots.innerText = ".".repeat(Search._pulse_status);
      if (Search._pulse_status >= 0) window.setTimeout(pulse, 500);
    };
    pulse();
  },

  /**
   * perform a search for something (or wait until index is loaded)
   */
  performSearch: function(query) {
    console.log("inside performSearch");
    if (!this.hasIndex()) {
      this.deferQuery(query);
      return;
    }

    var searchTerms = query.toLowerCase().split(/\s+/);
    var results = [];
    var allTitles = Search1._index ? Search1._index.alltitles : {};
    for (var title in allTitles) {
      if (searchTerms.some(term => title.toLowerCase().includes(term))) {
        var docname = Search1._index.docnames[Search1._index.alltitles[title][0][0]];
        this.fetchDocumentContent(docname, title, searchTerms, results);
      }
    }
  },

  fetchDocumentContent: function(docname, title, searchTerms, results) {
    console.log("inside fetchDocumentContent");
    console.log(docname);
    var xhr = new XMLHttpRequest();
    var directoryName = docname.split('/')[0];
    xhr.open('GET', '/assets/_static/document_content.json', true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var content = JSON.parse(xhr.responseText);
        var description = Search.extractDescription(content, searchTerms);
        var excerpts = Search.getExcerpts(description, searchTerms);
       
        console.log(docname);
        results.push({ title: title, description: description, links: directoryName, excerpts: excerpts });
        console.log("results", results);
        Search.appendResults(results);
      }
    };
    xhr.send();
  },

  extractDescription: function(content, searchTerms) {
    console.log("inside extractDescription");
    console.log(content.description);
    var div = document.createElement('div');
    div.innerHTML = content.description;
    var text = div.innerText || div.textContent || '';
    var regex = new RegExp(`(${searchTerms.join('|')})`, 'gi');
    var match = regex.exec(text);
    if (match) {
      var start = Math.max(match.index - 100, 0);
      var end = Math.min(match.index + 100, text.length);
      return text.substring(start, end);
    }
    return text.substring(0, 200); // Return first 200 characters if no match
  },

  /*
  extractDescription: function(content, searchTerms) {
    console.log("inside extractDescription");
    console.log(content);
    var div = document.createElement('div');
    div.innerHTML = content;
    var text = div.innerText || div.textContent || '';
    var regex = new RegExp(`(${searchTerms.join('|')})`, 'gi');
    var match = regex.exec(text);
    if (match) {
      var start = Math.max(match.index - 100, 0);
      var end = Math.min(match.index + 100, text.length);
      return text.substring(start, end);
    }
    return text.substring(0, 200); // Return first 200 characters if no match
  },
  */

  getExcerpts(text, terms){
    const excerpts = [];
    const regex = new RegExp(`(${terms.join('|')})`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(match.index - 30, 0);
      const end = Math.min(match.index + 30, text.length);
      excerpts.push(text.substring(start, end));
    }
    return excerpts;
  },
  appendResults: function(results) {
    console.log(results);
    var out_summary = document.getElementById('search-results-summary');
    var out = document.getElementById('search-results');
    out.innerHTML = ''; // Clear previous results

    if (results.length === 0) {
      out.innerHTML = '<p>No results found.</p>';
      return;
    }

    out_summary.innerHTML = 'Found '+results.length+' result(s)';
    

    var ul = document.createElement('ul');
    results.forEach(result => {
      var li = document.createElement('li');
      var title = document.createElement('h3');
      title.textContent = result.title;
      //li.appendChild(title);
      var link = document.createElement('a');
      link.innerHTML = "<h3>"+result.title+"</h3>";
      link.href = "/"+result.links;
      li.appendChild(link);

      var description = document.createElement('p');
      description.innerHTML = this.highlightText(result.description, result.title);
      li.appendChild(description);

      var excerpt = document.createElement('p');
      excerpt.textContent = result.excerpts; // Display the excerpt
      li.appendChild(excerpt);

      result.excerpts.forEach(excerpt => {
        var excerptElem = document.createElement('p');
        excerptElem.innerHTML = this.highlightText(excerpt, result.title);
        li.appendChild(excerptElem);
      });

      ul.appendChild(li);
    });
    
    out.appendChild(ul);
    
  },


  highlightText: function(text, query) {
    if (!text) return '';
    if (!query) return text;
    var terms = query.toLowerCase().split(/\s+/).filter(x => x);
    terms.forEach(term => {
      var regex = new RegExp('(' + term + ')', 'gi');
      text = text.replace(regex, '<span class="highlighted">$1</span>');
    });
    return text;
  },


  _parseQuery: (query) => {
    // stem the search terms and add them to the correct list
    const stemmer = new Stemmer();
    const searchTerms = new Set();
    const excludedTerms = new Set();
    const highlightTerms = new Set();
    const objectTerms = new Set(splitQuery(query.toLowerCase().trim()));
    splitQuery(query.trim()).forEach((queryTerm) => {
      const queryTermLower = queryTerm.toLowerCase();

      // maybe skip this "word"
      // stopwords array is from language_data.js
      if (
        stopwords.indexOf(queryTermLower) !== -1 ||
        queryTerm.match(/^\d+$/)
      )
        return;

      // stem the word
      let word = stemmer.stemWord(queryTermLower);
      // select the correct list
      if (word[0] === "-") excludedTerms.add(word.substr(1));
      else {
        searchTerms.add(word);
        highlightTerms.add(queryTermLower);
      }
    });

    if (SPHINX_HIGHLIGHT_ENABLED) {  // set in sphinx_highlight.js
      localStorage.setItem("sphinx_highlight_terms", [...highlightTerms].join(" "))
    }

    // console.debug("SEARCH: searching for:");
    // console.info("required: ", [...searchTerms]);
    // console.info("excluded: ", [...excludedTerms]);

    return [query, searchTerms, excludedTerms, highlightTerms, objectTerms];
  },

  /**
   * execute search (requires search index to be loaded)
   */
  _performSearch: (query, searchTerms, excludedTerms, highlightTerms, objectTerms) => {
    const filenames = Search1._index.filenames;
    const docNames = Search1._index.docnames;
    const titles = Search1._index.titles;
    const allTitles = Search1._index.alltitles;
    const indexEntries = Search1._index.indexentries;

    // Collect multiple result groups to be sorted separately and then ordered.
    // Each is an array of [docname, title, anchor, descr, score, filename].
    const normalResults = [];
    const nonMainIndexResults = [];

    _removeChildren(document.getElementById("search-progress"));

    const queryLower = query.toLowerCase().trim();
    for (const [title, foundTitles] of Object.entries(allTitles)) {
      if (title.toLowerCase().trim().includes(queryLower) && (queryLower.length >= title.length/2)) {
        for (const [file, id] of foundTitles) {
          const score = Math.round(Scorer.title * queryLower.length / title.length);
          const boost = titles[file] === title ? 1 : 0;  // add a boost for document titles
          normalResults.push([
            docNames[file],
            titles[file] !== title ? `${titles[file]} > ${title}` : title,
            id !== null ? "#" + id : "",
            null,
            score + boost,
            filenames[file],
          ]);
        }
      }
    }

    // search for explicit entries in index directives
    for (const [entry, foundEntries] of Object.entries(indexEntries)) {
      if (entry.includes(queryLower) && (queryLower.length >= entry.length/2)) {
        for (const [file, id, isMain] of foundEntries) {
          const score = Math.round(100 * queryLower.length / entry.length);
          const result = [
            docNames[file],
            titles[file],
            id ? "#" + id : "",
            null,
            score,
            filenames[file],
          ];
          if (isMain) {
            normalResults.push(result);
          } else {
            nonMainIndexResults.push(result);
          }
        }
      }
    }

    // lookup as object
    objectTerms.forEach((term) =>
      normalResults.push(...Search.performObjectSearch(term, objectTerms))
    );

    // lookup as search terms in fulltext
    normalResults.push(...Search.performTermsSearch(searchTerms, excludedTerms));

    // let the scorer override scores with a custom scoring function
    if (Scorer.score) {
      normalResults.forEach((item) => (item[4] = Scorer.score(item)));
      nonMainIndexResults.forEach((item) => (item[4] = Scorer.score(item)));
    }

    // Sort each group of results by score and then alphabetically by name.
    normalResults.sort(_orderResultsByScoreThenName);
    nonMainIndexResults.sort(_orderResultsByScoreThenName);

    // Combine the result groups in (reverse) order.
    // Non-main index entries are typically arbitrary cross-references,
    // so display them after other results.
    let results = [...nonMainIndexResults, ...normalResults];

    // remove duplicate search results
    // note the reversing of results, so that in the case of duplicates, the highest-scoring entry is kept
    let seen = new Set();
    results = results.reverse().reduce((acc, result) => {
      let resultStr = result.slice(0, 4).concat([result[5]]).map(v => String(v)).join(',');
      if (!seen.has(resultStr)) {
        acc.push(result);
        seen.add(resultStr);
      }
      return acc;
    }, []);
    
   
    return results.reverse();
  },

  query: (query) => {
    const [searchQuery, searchTerms, excludedTerms, highlightTerms, objectTerms] = Search._parseQuery(query);
    const results = Search._performSearch(searchQuery, searchTerms, excludedTerms, highlightTerms, objectTerms);

    // for debugging
    //Search.lastresults = results.slice();  // a copy
    // console.info("search results:", Search.lastresults);

    // print the results
    _displayNextItem(results, results.length, searchTerms, highlightTerms);
  },

  /**
   * search for object names
   */
  performObjectSearch: (object, objectTerms) => {
    const filenames = Search1._index.filenames;
    const docNames = Search1._index.docnames;
    const objects = Search1._index.objects;
    const objNames = Search1._index.objnames;
    const titles = Search1._index.titles;

    const results = [];

    const objectSearchCallback = (prefix, match) => {
      const name = match[4]
      const fullname = (prefix ? prefix + "." : "") + name;
      const fullnameLower = fullname.toLowerCase();
      if (fullnameLower.indexOf(object) < 0) return;

      let score = 0;
      const parts = fullnameLower.split(".");

      // check for different match types: exact matches of full name or
      // "last name" (i.e. last dotted part)
      if (fullnameLower === object || parts.slice(-1)[0] === object)
        score += Scorer.objNameMatch;
      else if (parts.slice(-1)[0].indexOf(object) > -1)
        score += Scorer.objPartialMatch; // matches in last name

      const objName = objNames[match[1]][2];
      const title = titles[match[0]];

      // If more than one term searched for, we require other words to be
      // found in the name/title/description
      const otherTerms = new Set(objectTerms);
      otherTerms.delete(object);
      if (otherTerms.size > 0) {
        const haystack = `${prefix} ${name} ${objName} ${title}`.toLowerCase();
        if (
          [...otherTerms].some((otherTerm) => haystack.indexOf(otherTerm) < 0)
        )
          return;
      }

      let anchor = match[3];
      if (anchor === "") anchor = fullname;
      else if (anchor === "-") anchor = objNames[match[1]][1] + "-" + fullname;

      const descr = objName + _(", in ") + title;

      // add custom score for some objects according to scorer
      if (Scorer.objPrio.hasOwnProperty(match[2]))
        score += Scorer.objPrio[match[2]];
      else score += Scorer.objPrioDefault;

      results.push([
        docNames[match[0]],
        fullname,
        "#" + anchor,
        descr,
        score,
        filenames[match[0]],
      ]);
    };
    Object.keys(objects).forEach((prefix) =>
      objects[prefix].forEach((array) =>
        objectSearchCallback(prefix, array)
      )
    );
    return results;
  },

  /**
   * search for full-text terms in the index
   */
  performTermsSearch: (searchTerms, excludedTerms) => {
    // prepare search
    const terms = Search1._index.terms;
    const titleTerms = Search1._index.titleterms;
    const filenames = Search1._index.filenames;
    const docNames = Search1._index.docnames;
    const titles = Search1._index.titles;

    const scoreMap = new Map();
    const fileMap = new Map();

    // perform the search on the required terms
    searchTerms.forEach((word) => {
      const files = [];
      const arr = [
        { files: terms[word], score: Scorer.term },
        { files: titleTerms[word], score: Scorer.title },
      ];
      // add support for partial matches
      if (word.length > 2) {
        const escapedWord = _escapeRegExp(word);
        if (!terms.hasOwnProperty(word)) {
          Object.keys(terms).forEach((term) => {
            if (term.match(escapedWord))
              arr.push({ files: terms[term], score: Scorer.partialTerm });
          });
        }
        if (!titleTerms.hasOwnProperty(word)) {
          Object.keys(titleTerms).forEach((term) => {
            if (term.match(escapedWord))
              arr.push({ files: titleTerms[term], score: Scorer.partialTitle });
          });
        }
      }

      // no match but word was a required one
      if (arr.every((record) => record.files === undefined)) return;

      // found search word in contents
      arr.forEach((record) => {
        if (record.files === undefined) return;

        let recordFiles = record.files;
        if (recordFiles.length === undefined) recordFiles = [recordFiles];
        files.push(...recordFiles);

        // set score for the word in each file
        recordFiles.forEach((file) => {
          if (!scoreMap.has(file)) scoreMap.set(file, {});
          scoreMap.get(file)[word] = record.score;
        });
      });

      // create the mapping
      files.forEach((file) => {
        if (!fileMap.has(file)) fileMap.set(file, [word]);
        else if (fileMap.get(file).indexOf(word) === -1) fileMap.get(file).push(word);
      });
    });

    // now check if the files don't contain excluded terms
    const results = [];
    for (const [file, wordList] of fileMap) {
      // check if all requirements are matched

      // as search terms with length < 3 are discarded
      const filteredTermCount = [...searchTerms].filter(
        (term) => term.length > 2
      ).length;
      if (
        wordList.length !== searchTerms.size &&
        wordList.length !== filteredTermCount
      )
        continue;

      // ensure that none of the excluded terms is in the search result
      if (
        [...excludedTerms].some(
          (term) =>
            terms[term] === file ||
            titleTerms[term] === file ||
            (terms[term] || []).includes(file) ||
            (titleTerms[term] || []).includes(file)
        )
      )
        break;

      // select one (max) score for the file.
      const score = Math.max(...wordList.map((w) => scoreMap.get(file)[w]));
      // add result to the result list
      results.push([
        docNames[file],
        titles[file],
        "",
        null,
        score,
        filenames[file],
      ]);
    }
    return results;
  },

  /**
   * helper function to return a node containing the
   * search summary for a given text. keywords is a list
   * of stemmed words.
   */
  makeSearchSummary: (htmlText, keywords, anchor) => {
    const text = Search.htmlToText(htmlText, anchor);
    if (text === "") return null;

    const textLower = text.toLowerCase();
    const actualStartPosition = [...keywords]
      .map((k) => textLower.indexOf(k.toLowerCase()))
      .filter((i) => i > -1)
      .slice(-1)[0];
    const startWithContext = Math.max(actualStartPosition - 120, 0);

    const top = startWithContext === 0 ? "" : "...";
    const tail = startWithContext + 240 < text.length ? "..." : "";

    let summary = document.createElement("p");
    summary.classList.add("context");
    summary.textContent = top + text.substr(startWithContext, 240).trim() + tail;
    console.log("summary", summary);
    console.log(summary); 
    return summary;
  },
};

_ready(Search.init);
}
