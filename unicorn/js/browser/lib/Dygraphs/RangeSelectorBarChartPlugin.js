// Copyright © 2015, Numenta, Inc. Unless you have purchased from
// Numenta, Inc. a separate commercial license for this software code, the
// following terms and conditions apply:
//
// This program is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero Public License version 3 as published by the
// Free Software Foundation.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Affero Public License for more details.
//
// You should have received a copy of the GNU Affero Public License along with
// this program. If not, see http://www.gnu.org/licenses.
//
// http://numenta.org/licenses/

import Dygraph from 'dygraphs';
import RGBColor from 'rgbcolor';

import Utils from '../../../main/Utils';


/**
 * DyGraph Plugin - RangeSelectorBarChart overlay for HTM Anomalies
 * @requries Dygraphs
 * @see https://github.com/danvk/dygraphs/tree/master/src/plugins
 * @see https://github.com/danvk/dygraphs/blob/master/src/plugins/range-selector.js
 */
export default class {

  /**
   * Construct Dygraphs Plugin object
   */
  constructor() {
    this._seriesIndex = 2;  // 2 for anomaly score field from model

    this._canvas = null;
    this._canvas_context = null;
    this._canvasRect = null;
    this._dygraph = null;
    this._graphDiv = null;
    this._interfaceCreated = false;
  }

  // --- public Dygraph Plugin API methods ---

  /**
   * Get Dygraphs Plugin info
   */
  toString() {
    return 'RangeSelector BarChart Plugin';
  }

  /**
   * Activate Dygraphs Plugin
   */
  activate(dygraph) {
    this._dygraph = dygraph;

    if (this._getOption('showRangeSelector')) {
      this._createInterface();
    }

    return {
      layout: this._reserveSpace,
      predraw: this._renderStaticLayer
    };
  }

  /**
   * Destroy Dygraphs Plugin
   */
  destroy() {
    this._canvas = null;
    this._canvas_context = null;
    this._canvasRect = null;
    this._dygraph = null;
    this._graphDiv = null;
    this._interfaceCreated= null;
  }

  // --- private methods ---

  /**
   * Adds the range selector bar charts to the graph.
   */
  _addToGraph() {
    let graphDiv = this._graphDiv = this._dygraph.graphDiv;
    graphDiv.appendChild(this._canvas);
  }

  /**
   * Creates the background and foreground canvases.
   */
  _createCanvases() {
    this._canvas = Dygraph.createCanvas();
    this._canvas.className = 'dygraph-rangeselbarchart-canvas';
    this._canvas.style.position = 'absolute';
    this._canvas.style.zIndex = 100; // @TODO was 9
    this._canvas_context = Dygraph.getContext(this._canvas);
  }

  /**
   * Creates the range selector bar chart elements and adds them to the graph.
   */
  _createInterface() {
    this._createCanvases();
    this._interfaceCreated = true;
    this._addToGraph();
  }

  /**
   * Draws the mini plot in the background canvas.
   */
  _drawMiniPlot() {
    let context = this._canvas_context;
    let graph = this._dygraph;
    let data = graph.rawData_;
    let xExtremes = this._dygraph.xAxisExtremes();
    let xRange = Math.max(xExtremes[1] - xExtremes[0], 1.e-30);
    let yRange = 1;
    let margin = 0.5;
    let canvasWidth = this._canvasRect.w - margin;
    let canvasHeight = this._canvasRect.h - margin;
    let strokeWidth = this._getOption('rangeSelectorPlotLineWidth');
    let xFactor = canvasWidth / xRange;
    let barWidth = Math.ceil(data.length / canvasWidth);
    let color, i, point, value, x;

    for (i=0; i<data.length; i+=barWidth) {
      let points = data.slice(i, i + barWidth - 1);
      let maxIndex = 0;
      points.forEach((point, index) => {
        if (point[this._seriesIndex] > points[maxIndex][this._seriesIndex]) {
          maxIndex = index;
        }
      });
      point = points[maxIndex]; // aggregate to prevent pixel overwriting

      value = point[this._seriesIndex];
      x = this._xValueToPixel(point[0], xExtremes[0], xFactor);

      if (isFinite(x) && (value >= 0.25)) {
        color = Utils.mapAnomalyColor(value, yRange);
        context.beginPath();
        context.moveTo(x, canvasHeight);
        context.lineTo(x, 0);
        context.closePath();
        this._canvas_context.strokeStyle = new RGBColor(color).toRGB();
        this._canvas_context.lineWidth = strokeWidth;
        context.stroke();
      }
    }
  }

  /**
   * Draws the static layer in the background canvas.
   */
  _drawStaticLayer() {
    let context = this._canvas_context;
    context.clearRect(0, 0, this._canvasRect.w, this._canvasRect.h);
    try {
      this._drawMiniPlot();
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Helper shortcut to get options from live Dygraphs chart
   */
  _getOption(name, series) {
    return this._dygraph.getOption(name, series);
  }

  /**
   * Removes the range selector bar charts from the graph.
   */
  _removeFromGraph() {
    let graphDiv = this._graphDiv;
    graphDiv.removeChild(this._canvas);
    this._graphDiv = null;
  }

  /**
   * Renders the static portion of the range selector bar charts at predraw.
   */
  _renderStaticLayer(event) {
    if (! this._updateVisibility()) {
      return;
    }
    this._resize();
    this._drawStaticLayer();
  }

  /**
   * Called by Layout to allow range selector bar charts to reserve its space.
   */
  _reserveSpace(event) {
    if (this._getOption('showRangeSelector')) {
      event.reserveSpaceBottom(this._getOption('rangeSelectorHeight') + 4);
    }
  }

  /**
   * Resizes the range selector bar charts
   */
  _resize() {
    let plotArea = this._dygraph.layout_.getPlotArea();
    let xAxisLabelHeight = 0;

    if (this._dygraph.getOptionForAxis('drawAxis', 'x')) {
      xAxisLabelHeight = this._getOption('xAxisHeight') || (
        (this._getOption('axisLabelFontSize') + 2) *
          this._getOption('axisTickSize')
      );
    }
    this._canvasRect = {
      x: plotArea.x,
      y: plotArea.y + plotArea.h + xAxisLabelHeight + 4,
      w: plotArea.w,
      h: this._getOption('rangeSelectorHeight')
    };

    this._setElementRect(this._canvas, this._canvas_context, this._canvasRect);
  }

  /**
   * Resize/Rescale a DOM element via Dygraphs utils and css
   */
  _setElementRect(canvas, context, rect) {
    let canvasScale = Dygraph.getContextPixelRatio(context);

    canvas.style.top = `${rect.y}px`;
    canvas.style.left = `${rect.x}px`;
    canvas.width = rect.w * canvasScale;
    canvas.height = rect.h * canvasScale;
    canvas.style.width = `${rect.w}px`;
    canvas.style.height = `${rect.h}px`;

    if (canvasScale !== 1) {
      context.scale(canvasScale, canvasScale);
    }
  }

  /**
   * Check to see if the range selector is en/disabled and update visibility.
   */
  _updateVisibility() {
    let enabled = this._getOption('showRangeSelector');
    let hasData = !isNaN(this._dygraph.rawData_[0][this._seriesIndex]);

    if (enabled) {
      if (!this._interfaceCreated) {
        this._createInterface();
      } else if (hasData && (!this._graphDiv || !this._graphDiv.parentNode)) {
        this._addToGraph();
      }
    } else if (this._graphDiv) {
      let dygraph = this._dygraph;
      this._removeFromGraph();
      setTimeout(() => {
        dygraph.width_ = 0;
        dygraph.resize();
      }, 1);
    }
    return enabled;
  }

  /**
   * Convert X value (ts) to X Pixel Coord
   */
  _xValueToPixel(x, xMax, xFactor) {
    if (x !== null) {
      return parseInt((x - xMax) * xFactor, 10);
    }
    return NaN;
  }

  /**
   * Convert Y value (data value) to Y Pixel Coord
   */
  _yValueToPixel(y, yMin, yMax, yFactor) {
    if (y !== null) {
      return parseInt(yMax - ((y - yMin) * yFactor), 10);
    }
    return NaN;
  }

}
