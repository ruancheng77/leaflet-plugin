L.Measure = L.Polyline.extend({

    statics: {
        notStartedState: 0,
        startState: 1,
        runState: 2,
        endedState: 3,
        pointIcon: L.icon({
            iconUrl: 'measure/images/measure-point.png',
            iconSize: [6, 6],
            iconAnchor: [3, 3],
        }),
        preLineColor: "#faba99",
        lineColor: "red",
        cursorClassName: "measure-cur",
        msgClassName: "measure-msg",
    },

    options: {},

    initialize: function(map, options) {
        // L.Polyline.prototype.initialize.call(this, [], options);
        this._map = map;
        this._container = map.getContainer();
        this._currentIdx = 0;
        this._state = L.Measure.notStartedState;
        this._preLine = null;
        this._points = [];
        this._endPopup = null;
        this._promptBox = null;
        this._totalDistance = 0;
        this._distance_unit = "米";
    },

    isRunning: function() {
        return this._state === L.Measure.runState;
    },

    isEnded: function() {
        return this._state === L.Measure.endedState;
    },

    isStarted: function() {
        return this._state !== L.Measure.notStartedState;
    },

    start: function(latlng) {
        if (this.isRunning()) {
            return;
        }
        var _this = this;
        _this._state = L.Measure.startState;
        _this.changeCursor();
        // 禁止双击缩放
        _this._map.doubleClickZoom.disable();
        _this._map.once("click", function(e) {
            if (_this._state == L.Measure.startState) {
                _this._state = L.Measure.runState;
            }
        });
        _this._map.once("dblclick", function(e) {
            _this._state = L.Measure.endedState;
            if (_this._points.length > 0) {
                var startLatLng = _this._points[0].getLatLng();
                if (startLatLng.lat === e.latlng.lat && startLatLng.lng === e.latlng.lng) {
                    _this.clear();
                    return;
                } else {
                    _this._preLine && _this._preLine.remove();
                    _this._promptBox && _this._promptBox.remove();
                    _this._endPopup.setContent(_this.getContent(_this._endPopup, 3));
                    _this.changeCursor();
                    // 结束测距，启动双击缩放
                    setTimeout(function() {
                        _this._map.doubleClickZoom.enable();
                    }, 100);
                }
            }
        });
        _this._map.on("click", function(e) {
            if (_this._state === L.Measure.runState) {
                _this.addPoint(e.latlng);
            }
        });
        _this._map.on("mousemove", function(e) {
            if (_this._state === L.Measure.startState) {
                // 鼠标点击，确定提示框
                if (!_this._promptBox) {
                    _this._promptBox = _this.getMsgPopup();
                    _this._promptBox.setLatLng(e.latlng);
                    _this._promptBox.addTo(_this._map);
                    _this._promptBox.setContent(_this.getContent(_this._promptBox, 1));
                    _this.calPopupPosition(_this._promptBox, 1);
                } else {
                    _this._promptBox.setLatLng(e.latlng);
                }
            } else if (_this._state === L.Measure.runState) {
                var latlng = _this._points[_this._points.length - 1].getLatLng();
                _this._preLine.setLatLngs([latlng, e.latlng]);
                _this._promptBox.setContent(_this.getContent(_this._promptBox, 2));
                _this._promptBox.setLatLng(e.latlng);
            }
        });
        return _this;
    },

    changeCursor: function() {
        if (this._state === L.Measure.startState || this._state === L.Measure.runState) {
            this._container.classList.add(L.Measure.cursorClassName, true);
        } else if (this._state === L.Measure.endedState) {
            this._container.classList.remove(L.Measure.cursorClassName, false);
        }
    },

    /**
     * 添加测量点
     */
    addPoint: function(latlng) {
        var marker = L.marker(latlng, {
            icon: L.Measure.pointIcon
        });
        marker.addTo(this._map);
        this._points.push(marker);
        var popup = this.getMsgPopup();
        popup.setLatLng(latlng);
        popup.openOn(this._map);
        this._endPopup = popup;
        if (this._points.length == 1) {
            popup.setContent(this.getContent(popup, 0));
        } else {
            popup.setContent(this.getContent(popup));
        }
        if (!this._measureLine) {
            this._measureLine = L.polyline([latlng], { color: L.Measure.lineColor });
            this._measureLine.addTo(this._map);
        } else {
            this._measureLine.addLatLng(latlng);
        }
        if (!this._preLine) {
            this._preLine = L.polyline([latlng], { color: L.Measure.preLineColor });
            this._preLine.addTo(this._map);
        }
    },

    getMsgPopup: function() {
        return L.popup({
            className: L.Measure.msgClassName,
            closeButton: false,
            autoClose: false,
            closeOnEscapeKey: false,
            closeOnClick: false
        });
    },

    /** 计算测量距离*/
    calDistance: function() {
        this._totalDistance = 0;
        if (this._points.length === 1) {
            return;
        } else {
            for (let i = 0; i < this._points.length - 1; i++) {
                const p1 = this._points[i].getLatLng();
                const p2 = this._points[i + 1].getLatLng();
                this._totalDistance += this._map.distance(p1, p2);
            }
        }
        this._totalDistance = Math.round(this._totalDistance);
        if (this._totalDistance <= 1000) {
            this._distance_unit = "米";
        } else if (this._totalDistance > 1000) {
            this._totalDistance /= 1000;
            this._distance_unit = "公里";
        }
    },

    /** 
     * 获取预判断距离
     * @return 距离
     */
    getPreDistance: function() {
        var distance = Math.round(this._map.distance(this._points[this._points.length - 1].getLatLng(), this._preLine.getLatLngs()[1]));
        if (this._distance_unit === "公里") {
            distance += this._totalDistance * 1000;
        } else {
            distance += this._totalDistance;
        }
        if (distance <= 1000) {
            this._distance_unit = "米";
        } else if (distance > 1000) {
            this._distance_unit = "公里";
            distance /= 1000;
        }
        return distance;
    },

    /** 获取提示内容 */
    getContent: function(popup, type) {
        this.calPopupPosition(popup, type);
        if (type === 0) {
            return "<div class='m_dist'>起点</div>";
        } else if (type === 1) {
            return "<div class='m_distEnd'>单击确定起点</div>";
        } else if (type === 2) {
            return "<div class='text-left m_distEnd'>总长：<span class='m_distImp'>" + this.getPreDistance() + "</span>" + this._distance_unit + "<br/><span class='m_dist'>单击确定地点，双击结束</span></div>";
        } else if (type === 3) {
            this.calDistance();
            return "<div class='m_distEnd'>总长：<span class='m_distImp'>" + this._totalDistance + "</span>" + this._distance_unit + "</div>";
        } else {
            this.calDistance();
            return "<div class='m_dist'><span>" + this._totalDistance + this._distance_unit + "</span></div>";
        }
    },

    /** 计算提示框位置 */
    calPopupPosition: function(popup, type) {
        var ele = popup.getElement();
        var rect = ele.firstElementChild.getBoundingClientRect();
        if (type === 1) {
            ele.firstElementChild.style.left = "50px";
            ele.firstElementChild.style.top = "50px";
        } else if (type === 2) {
            ele.firstElementChild.style.left = Math.ceil(rect.width / 2) + 20 + "px";
            ele.firstElementChild.style.top = Math.ceil(rect.height) + 6 + "px";
        } else if (type === 3) {
            ele.firstElementChild.style.left = "50px";
            ele.firstElementChild.style.top = "42px";
        } else {
            ele.firstElementChild.style.left = "40px";
            ele.firstElementChild.style.top = "22px";
        }
    },

    clear: function() {
        this._measureLine && this._measureLine.remove();
        this._preLine && this._preLine.remove();
        this._endPopup && this._endPopup.remove();
        this._points.forEach(function(item) {
            item.remove();
        });
        this._state = this._state.endedState;
    }

});
L.measure = function(options) {
    return new L.Measure(options);
};