/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/*jslint sloppy:true */
/*global Windows:true, require, document, setTimeout, window, module */



var cordova = require('cordova'),
    channel = require('cordova/channel'),
    urlutil = require('cordova/urlutil');

var browserWrap,
    popup,
    compusportDiv,
    compusportDivInner,
    backButton,
    reloadButton,
    bodyOverflowStyle;

// x-ms-webview is available starting from Windows 8.1 (platformId is 'windows')
// http://msdn.microsoft.com/en-us/library/windows/apps/dn301831.aspx
var isWebViewAvailable = cordova.platformId == 'windows';

function attachNavigationEvents(element, callback) {
    if (isWebViewAvailable) {
        element.addEventListener("MSWebViewNavigationStarting", function (e) {
            callback({ type: "loadstart", url: e.uri }, { keepCallback: true });

            if (e.uri.indexOf("app_webview_noheader") != -1) {
                popup.style.height = "calc(100% - 60px)";
                compusportDiv.style.display = "block";
            } else {
                popup.style.height = "100%";
                compusportDiv.style.display = "none";
            }
        });

        element.addEventListener("MSWebViewNavigationCompleted", function (e) {
            callback({ type: e.isSuccess ? "loadstop" : "loaderror", url: e.uri }, { keepCallback: true });
        });

        element.addEventListener("MSWebViewUnviewableContentIdentified", function (e) {
            // WebView found the content to be not HTML.
            // http://msdn.microsoft.com/en-us/library/windows/apps/dn609716.aspx
            callback({ type: "loaderror", url: e.uri }, { keepCallback: true });
        });

        element.addEventListener("MSWebViewContentLoading", function (e) {
            if (compusportDiv) {
                backButton.disabled = !popup.canGoBack;
            }
        });

        WinJS.Application.onbackclick = function () {
            if (popup.canGoBack)
                popup.goBack();

            return true;
        }
    } else {
        var onError = function () {
            callback({ type: "loaderror", url: this.contentWindow.location }, { keepCallback: true });
        };

        element.addEventListener("unload", function () {
            callback({ type: "loadstart", url: this.contentWindow.location }, { keepCallback: true });
        });

        element.addEventListener("load", function () {
            callback({ type: "loadstop", url: this.contentWindow.location }, { keepCallback: true });
        });

        element.addEventListener("error", onError);
        element.addEventListener("abort", onError);
    }
}

var IAB = {
    close: function (win, lose) {
        if (browserWrap) {
            if (win) win({ type: "exit" });

            browserWrap.parentNode.removeChild(browserWrap);
            // Reset body overflow style to initial value
            document.body.style.msOverflowStyle = bodyOverflowStyle;
            browserWrap = null;
            popup = null;
        }
    },
    show: function (win, lose) {
        if (browserWrap) {
            browserWrap.style.display = "block";
        }
    },
    open: function (win, lose, args) {
        var strUrl = args[0],
            target = args[1],
            features = args[2],
            url;

        if (target === "_system") {
            url = new Windows.Foundation.Uri(strUrl);
            Windows.System.Launcher.launchUriAsync(url);
        } else if (target === "_self" || !target) {
            window.location = strUrl;
        } else {
            // "_blank" or anything else
            if (!browserWrap) {
                var browserWrapStyle = document.createElement('link');
                browserWrapStyle.rel = "stylesheet";
                browserWrapStyle.type = "text/css";
                browserWrapStyle.href = urlutil.makeAbsolute("/www/css/inappbrowser.css");

                document.head.appendChild(browserWrapStyle);

                browserWrap = document.createElement("div");
                browserWrap.className = "inAppBrowserWrap";

                if (features.indexOf("fullscreen=yes") > -1) {
                    browserWrap.classList.add("inAppBrowserWrapFullscreen");
                }

                // Save body overflow style to be able to reset it back later
                bodyOverflowStyle = document.body.style.msOverflowStyle;

                browserWrap.onclick = function () {
                    setTimeout(function () {
                        IAB.close(win);
                    }, 0);
                };

                document.body.appendChild(browserWrap);
                // Hide scrollbars for the whole body while inappbrowser's window is open
                document.body.style.msOverflowStyle = "none";
            }

            if (features.indexOf("hidden=yes") !== -1) {
                browserWrap.style.display = "none";
            }

            popup = document.createElement(isWebViewAvailable ? "x-ms-webview" : "iframe");
            if (popup instanceof HTMLIFrameElement) {
                // For iframe we need to override bacground color of parent element here
                // otherwise pages without background color set will have transparent background
                popup.style.backgroundColor = "white";
            }
            popup.style.borderWidth = "0px";
            popup.style.width = "100%";

            {
                compusportDiv = document.createElement("div");
                compusportDiv.style.height = "40px";
                compusportDiv.style.backgroundColor = "#000";
                compusportDiv.style.zIndex = "999";
                compusportDiv.style.display = "none";
                compusportDiv.onclick = function (e) {
                    e.cancelBubble = true;
                };

                compusportDivInner = document.createElement("div");
                compusportDivInner.style.paddingTop = "5px";
                compusportDivInner.style.height = "40px";
                compusportDivInner.style.position = "absolute";
                compusportDivInner.style.right = "0";
                compusportDivInner.style.margin = "0 auto";
                compusportDivInner.style.backgroundColor = "#000";
                compusportDivInner.style.zIndex = "999";
                compusportDivInner.onclick = function (e) {
                    e.cancelBubble = true;
                };


                backButton = document.createElement("div");
                backButton.style.width = "35px";
                backButton.style.height = "35px";
                backButton.style.right = "45px";
                backButton.style.position = "absolute";
                backButton.style.backgroundImage = "url(/images/ic_action_back.png)";
                backButton.style.backgroundSize = "cover";

                backButton.addEventListener("click", function (e) {
                    if (popup.canGoBack)
                        popup.goBack();
                });

                reloadButton = document.createElement("div");
                reloadButton.style.width = "35px";
                reloadButton.style.height = "35px";
                reloadButton.style.right = "10px";
                reloadButton.style.backgroundSize = "cover";
                reloadButton.style.position = "absolute";

                reloadButton.style.backgroundImage = "url(/images/ic_action_refresh.png)";
                reloadButton.addEventListener("click", function (e) {
                    popup.refresh();
                });

                compusportDivInner.appendChild(backButton);
                compusportDivInner.appendChild(reloadButton);
                compusportDiv.appendChild(compusportDivInner);

                browserWrap.appendChild(compusportDiv);
            }

            popup.style.height = "100%";

            browserWrap.appendChild(popup);

            // start listening for navigation events
            attachNavigationEvents(popup, win);

            if (isWebViewAvailable) {
                strUrl = strUrl.replace("ms-appx://", "ms-appx-web://");
            }
            popup.src = strUrl;
        }
    },

    navigate: function (win, lose, args) {
        var strUrl = args[0];

        strUrl = strUrl.replace("ms-appx://", "ms-appx-web://");
        popup.src = strUrl;
    },

    injectScriptCode: function (win, fail, args) {
        var code = args[0],
            hasCallback = args[1];

        if (isWebViewAvailable && browserWrap && popup) {
            var op = popup.invokeScriptAsync("eval", code);
            op.oncomplete = function (e) {
                var result = [e.target.result];
                hasCallback && win(result);
            };
            op.onerror = function () { };
            op.start();
        }
    },

    injectScriptFile: function (win, fail, args) {
        var filePath = args[0],
            hasCallback = args[1];

        if (!!filePath) {
            filePath = urlutil.makeAbsolute(filePath);
        }

        if (isWebViewAvailable && browserWrap && popup) {
            var uri = new Windows.Foundation.Uri(filePath);
            Windows.Storage.StorageFile.getFileFromApplicationUriAsync(uri).done(function (file) {
                Windows.Storage.FileIO.readTextAsync(file).done(function (code) {
                    var op = popup.invokeScriptAsync("eval", code);
                    op.oncomplete = function (e) {
                        var result = [e.target.result];
                        hasCallback && win(result);
                    };
                    op.onerror = function () { };
                    op.start();
                });
            });
        }
    },

    injectStyleCode: function (win, fail, args) {
        var code = args[0],
            hasCallback = args[1];

        if (isWebViewAvailable && browserWrap && popup) {
            injectCSS(popup, code, hasCallback && win);
        }
    },

    injectStyleFile: function (win, fail, args) {
        var filePath = args[0],
            hasCallback = args[1];

        filePath = filePath && urlutil.makeAbsolute(filePath);

        if (isWebViewAvailable && browserWrap && popup) {
            var uri = new Windows.Foundation.Uri(filePath);
            Windows.Storage.StorageFile.getFileFromApplicationUriAsync(uri).then(function (file) {
                return Windows.Storage.FileIO.readTextAsync(file);
            }).done(function (code) {
                injectCSS(popup, code, hasCallback && win);
            }, function () {
                // no-op, just catch an error
            });
        }
    }
};

function injectCSS(webView, cssCode, callback) {
    // This will automatically escape all thing that we need (quotes, slashes, etc.)
    var escapedCode = JSON.stringify(cssCode);
    var evalWrapper = "(function(d){var c=d.createElement('style');c.innerHTML=%s;d.head.appendChild(c);})(document)"
        .replace('%s', escapedCode);

    var op = webView.invokeScriptAsync("eval", evalWrapper);
    op.oncomplete = function () {
        callback && callback([]);
    };
    op.onerror = function () { };
    op.start();
}

module.exports = IAB;

require("cordova/exec/proxy").add("InAppBrowser", module.exports);
