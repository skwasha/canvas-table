"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const canvas_1 = require("canvas");
const defaultOptions_1 = require("./defaultOptions");
const fs_1 = require("fs");
const isNode = typeof window === "undefined";
class CanvasTable {
    constructor(canvas, config) {
        this.columnOuterWidths = [];
        this.computedOuterWidths = [];
        this.horizontalTotalPadding = 0;
        this.isGenerated = false;
        this.tableHeight = 0;
        this.tableStartX = 0;
        this.tableStartY = 0;
        this.tableWidth = 0;
        this.x = 0;
        this.y = 0;
        this.canvas_ = canvas;
        this.canvasHeight = canvas.height;
        this.canvasWidth = canvas.width;
        this.config = config;
        this.ctx = canvas.getContext("2d");
        this.populateOptions();
        this.calculateTableDimensions();
        if (this.options.background) {
            this.ctx.fillStyle = this.options.background;
            this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        }
        this.ctx.textBaseline = "top";
        this.columns = config.columns || [];
        this.data = config.data;
        if (this.options.header && config.columns) {
            this.data = [config.columns.map((column) => column.title), ...this.data];
        }
    }
    toArray(items, columnNames) {
        if (Array.isArray(items))
            return items;
        let rows = [];
        for (let key in items) {
            let item = {};
            item[columnNames[0] || "key"] = key;
            item[columnNames[1] || "value"] = items[key];
            rows.push(item);
        }
        return rows;
    }
    generateTable() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const { options: { padding, watermark, title, subtitle }, } = this;
                const tablePadding = this.calculatePadding(padding);
                this.y = tablePadding.top;
                this.x = tablePadding.left;
                try {
                    this.generateWatermark(watermark);
                    this.generateTitle(title);
                    this.generateTitle(subtitle);
                    this.calculateColumnWidths();
                    this.tableStartX = this.x;
                    this.tableStartY = this.y;
                    this.generateRows();
                    this.generateFaders();
                    this.drawTableBorders();
                }
                catch (error) {
                    reject(error);
                }
                this.isGenerated = true;
                resolve();
            });
        });
    }
    renderToBlob() {
        return __awaiter(this, void 0, void 0, function* () {
            this.throwErrorIfNotGenerated();
            return new Promise((resolve, reject) => {
                if (this.canvas_ instanceof canvas_1.Canvas) {
                    reject(new Error(CanvasTable.NOT_AVAILABLE_ON_NODE));
                    return;
                }
                this.canvas_.toBlob(resolve);
            });
        });
    }
    renderToBuffer() {
        return __awaiter(this, void 0, void 0, function* () {
            this.throwErrorIfNotGenerated();
            if (!(this.canvas_ instanceof canvas_1.Canvas)) {
                throw new Error(CanvasTable.NOT_AVAILABLE_ON_BROWSER);
            }
            return this.canvas_.toBuffer();
        });
    }
    renderToFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            this.throwErrorIfNotGenerated();
            const buffer = yield this.renderToBuffer();
            return new Promise((resolve, reject) => {
                fs_1.writeFile(filePath, buffer, (error) => error ? reject(error) : resolve());
            });
        });
    }
    tableDimensions() {
        return {
            height: this.tableHeight,
            width: this.tableWidth,
            x: this.x,
            y: this.y,
        };
    }
    calculateColumnTextWidths() {
        const { ctx, data, options: { cell, header }, } = this;
        const columnWidths = Array(data[0].length).fill(1);
        for (const rowIndex in data) {
            const row = data[rowIndex];
            for (const cellIndex in row) {
                const [cellValue] = (row[cellIndex] || "").split("\n");
                const option = header && rowIndex === "0" ? header : cell;
                ctx.font = `${option.fontWeight} ${option.fontSize} ${option.fontFamily}`;
                ctx.fillStyle = option.color;
                ctx.textAlign = option.textAlign;
                const metrics = ctx.measureText(cellValue);
                if (metrics.width > columnWidths[cellIndex]) {
                    columnWidths[cellIndex] = metrics.width;
                }
            }
        }
        return columnWidths;
    }
    calculateColumnWidths() {
        const { ctx, options: { cell, fit }, tableWidth, } = this;
        const columnTextWidths = this.calculateColumnTextWidths();
        const cellPadding = this.calculatePadding(cell.padding);
        this.horizontalTotalPadding = cellPadding.left + cellPadding.right;
        const columnPaddingTotal = this.horizontalTotalPadding * columnTextWidths.length;
        const totalColumnWidths = columnTextWidths.reduce((a, b) => a + b, 0);
        const columnWidthTotal = totalColumnWidths + columnPaddingTotal;
        this.columnOuterWidths = columnTextWidths.map((width) => width + this.horizontalTotalPadding);
        this.computedOuterWidths = [...this.columnOuterWidths];
        const minWidth = ctx.measureText(`${CanvasTable.ELLIPSIS}${CanvasTable.ELLIPSIS}`).width;
        const minWidthWithPadding = minWidth + this.horizontalTotalPadding;
        if (columnWidthTotal > tableWidth) {
            this.computedOuterWidths = [];
            const fatColumnIndexes = [];
            const reservedWidth = tableWidth / this.columnOuterWidths.length;
            let totalFatWidth = 0;
            let remainingWidth = tableWidth;
            this.columnOuterWidths.forEach((columnOuterWidth, columnIndex) => {
                this.computedOuterWidths.push(columnOuterWidth);
                if (columnOuterWidth > reservedWidth) {
                    fatColumnIndexes.push(columnIndex);
                    totalFatWidth = totalFatWidth + columnOuterWidth;
                }
                else {
                    remainingWidth = remainingWidth - columnOuterWidth;
                }
            });
            fatColumnIndexes.forEach((index) => {
                const columnOuterWidth = this.columnOuterWidths[index];
                const fatWidth = (columnOuterWidth / totalFatWidth) * remainingWidth;
                this.computedOuterWidths[index] =
                    fatWidth < minWidthWithPadding ? minWidthWithPadding : fatWidth;
            });
        }
        else if (fit && columnWidthTotal < tableWidth) {
            const difference = tableWidth - columnWidthTotal;
            this.computedOuterWidths = columnTextWidths.map((width) => width +
                (difference * width) / totalColumnWidths +
                this.horizontalTotalPadding);
        }
    }
    calculateTableDimensions() {
        const { canvas_, canvasHeight, canvasWidth, ctx, options: { devicePixelRatio, padding }, } = this;
        canvas_.width = canvasWidth * devicePixelRatio;
        canvas_.height = canvasHeight * devicePixelRatio;
        if ("style" in canvas_) {
            canvas_.style.width = `${canvasWidth}px`;
            canvas_.style.height = `${canvasHeight}px`;
        }
        const tablePadding = this.calculatePadding(padding);
        this.tableHeight = canvasHeight - tablePadding.top - tablePadding.bottom;
        this.tableWidth = canvasWidth - tablePadding.left - tablePadding.right;
        ctx.scale(devicePixelRatio, devicePixelRatio);
    }
    calculatePadding(padding) {
        const value = !padding ? 0 : padding;
        if (typeof value === "number") {
            return {
                bottom: value,
                left: value,
                right: value,
                top: value,
            };
        }
        return value;
    }
    generateWatermark(watermark) {
        const { ctx, canvasWidth, canvasHeight } = this;
        if (!watermark.text) {
            return;
        }
        ctx.font = `${watermark.fontWeight} ${watermark.fontSize} ${watermark.fontFamily}`;
        ctx.fillStyle = watermark.color;
        ctx.textAlign = watermark.textAlign;
        const lineHeight = Math.round(parseInt(watermark.fontSize, 10) * watermark.lineHeight);
        const watermarkX = watermark.textAlign === "center" ? canvasWidth / 2 : 0;
        const watermarkY = watermark.textAlign === "center" ? canvasHeight / 2 - lineHeight / 2 : 0;
        const isFat = (text) => ctx.measureText(text).width > this.tableWidth;
        let cellValue = watermark.text;
        const valueWithEllipsis = () => `${cellValue}${CanvasTable.ELLIPSIS}`;
        if (isFat(valueWithEllipsis())) {
            while (isFat(valueWithEllipsis())) {
                cellValue = cellValue.slice(0, -1);
            }
            cellValue = valueWithEllipsis();
        }
        ctx.fillText(cellValue, watermarkX, watermarkY);
    }
    generateTitle(title) {
        const { ctx, tableWidth, x, y } = this;
        if (!title.text) {
            return;
        }
        ctx.font = `${title.fontWeight} ${title.fontSize} ${title.fontFamily}`;
        ctx.fillStyle = title.color;
        ctx.textAlign = title.textAlign;
        const lineHeight = Math.round(parseInt(title.fontSize, 10) * title.lineHeight);
        const titleLines = title.text.split("\n");
        const titleX = title.textAlign === "center" ? tableWidth / 2 : 0;
        let lineIndex = 0;
        const isFat = (text) => ctx.measureText(text).width > this.tableWidth;
        titleLines.forEach((line) => {
            const innerLines = [];
            if (title.multiline) {
                innerLines.push("");
                const lineArray = line.split(" ");
                lineArray.forEach((lineValue) => {
                    const index = innerLines.length - 1;
                    const nextValue = `${innerLines[index]} ${lineValue}`;
                    if (isFat(nextValue)) {
                        innerLines.push(lineValue);
                    }
                    else {
                        innerLines[index] = nextValue;
                    }
                });
            }
            else {
                let cellValue = line;
                const valueWithEllipsis = () => `${cellValue}${CanvasTable.ELLIPSIS}`;
                if (isFat(valueWithEllipsis())) {
                    while (isFat(valueWithEllipsis())) {
                        cellValue = cellValue.slice(0, -1);
                    }
                    cellValue = valueWithEllipsis();
                }
                innerLines.push(cellValue);
            }
            innerLines.forEach((innerLine) => ctx.fillText(innerLine, x + titleX, y + lineIndex++ * lineHeight));
        });
        this.y += lineIndex * lineHeight + lineHeight / 2;
    }
    generateRows() {
        const { canvasHeight, columnOuterWidths, columns, computedOuterWidths, ctx, data, horizontalTotalPadding, options: { cell, header, minCharWidth }, tableStartX, } = this;
        const cellPadding = this.calculatePadding(cell.padding);
        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            const lineHeight = cell.lineHeight * parseInt(cell.fontSize, 10) +
                cellPadding.bottom +
                cellPadding.top;
            this.x = tableStartX;
            for (const cellIndex in columnOuterWidths) {
                const outerWidth = columnOuterWidths[cellIndex];
                const computedOuterWidth = computedOuterWidths[cellIndex];
                const columnOptions = columns && columns[cellIndex].options
                    ? columns[cellIndex].options
                    : {};
                let [cellValue] = row[cellIndex].split("\n");
                if (!rowIndex && header && header.background) {
                    ctx.fillStyle = header.background;
                    ctx.fillRect(this.x, this.y, computedOuterWidth, lineHeight);
                }
                const option = header && !rowIndex ? header : Object.assign(Object.assign({}, cell), columnOptions);
                ctx.font = `${option.fontWeight} ${option.fontSize} ${option.fontFamily}`;
                ctx.fillStyle = option.color;
                const textAlign = columnOptions && columnOptions.textAlign
                    ? columnOptions.textAlign
                    : option.textAlign;
                ctx.textAlign = textAlign;
                if (outerWidth > computedOuterWidth) {
                    const isFat = () => ctx.measureText(cellValue.length > minCharWidth
                        ? `${cellValue}${CanvasTable.ELLIPSIS}`
                        : `${cellValue}.`).width >
                        computedOuterWidth - horizontalTotalPadding;
                    if (isFat()) {
                        while (isFat()) {
                            cellValue = cellValue.slice(0, -1);
                        }
                        cellValue =
                            cellValue.length > minCharWidth
                                ? `${cellValue}${CanvasTable.ELLIPSIS}`
                                : `${cellValue}.`;
                    }
                }
                let cellX = this.x + cellPadding.left;
                let cellY = this.y + cellPadding.top;
                if (textAlign === "right") {
                    cellX = this.x + computedOuterWidth - cellPadding.right;
                }
                if (textAlign === "center") {
                    cellX = this.x + computedOuterWidth / 2;
                }
                ctx.fillText(cellValue, cellX, cellY);
                this.x += computedOuterWidth;
                this.drawRowBorder(lineHeight);
            }
            this.y += lineHeight;
            this.drawColumnBorder(rowIndex);
            if (this.y > canvasHeight) {
                break;
            }
        }
    }
    drawColumnBorder(rowIndex) {
        const { ctx, options: { borders, header }, tableStartX, x, y, } = this;
        const columnBorder = !rowIndex && header && borders.header ? borders.header : borders.column;
        if (!columnBorder) {
            return;
        }
        ctx.beginPath();
        ctx.moveTo(tableStartX, y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = columnBorder.color;
        ctx.lineWidth = columnBorder.width;
        ctx.stroke();
    }
    drawRowBorder(lineHeight) {
        const { ctx, options: { borders: { row }, }, } = this;
        if (!row) {
            return;
        }
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y + lineHeight);
        ctx.strokeStyle = row.color;
        ctx.lineWidth = row.width;
        ctx.stroke();
    }
    generateFaders() {
        const { canvasHeight, canvasWidth, ctx, options: { background, fader }, x, y, } = this;
        if (!fader) {
            return;
        }
        if (y > canvasHeight && fader.bottom) {
            var bottomFader = ctx.createLinearGradient(0, canvasHeight - fader.size, 0, canvasHeight);
            bottomFader.addColorStop(0, CanvasTable.TRANSPARENT_COLOR);
            bottomFader.addColorStop(1, background);
            ctx.fillStyle = bottomFader;
            ctx.fillRect(0, canvasHeight - fader.size, canvasWidth, fader.size);
        }
        if (x > canvasWidth && fader.right) {
            var rightFader = ctx.createLinearGradient(canvasWidth - fader.size, 0, canvasWidth, 0);
            rightFader.addColorStop(0, CanvasTable.TRANSPARENT_COLOR);
            rightFader.addColorStop(1, background);
            ctx.fillStyle = rightFader;
            ctx.fillRect(canvasWidth - fader.size, 0, fader.size, canvasHeight);
        }
    }
    drawTableBorders() {
        const { table } = this.options.borders;
        if (!table) {
            return;
        }
        const { ctx, tableStartX, tableStartY, x, y } = this;
        ctx.strokeStyle = table.color;
        ctx.lineWidth = table.width;
        ctx.strokeRect(tableStartX, tableStartY, x - tableStartX, y - tableStartY);
    }
    populateOptions() {
        const { options } = this.config;
        if (!options) {
            this.options = Object.assign({}, defaultOptions_1.default);
            return;
        }
        const { borders, header, cell, fader, subtitle, title, watermark, } = defaultOptions_1.default;
        const defaultPadding = defaultOptions_1.default.padding;
        const padding = options.padding !== undefined
            ? typeof options.padding !== "number"
                ? Object.assign(Object.assign({}, defaultPadding), options.padding) : options.padding
            : defaultPadding;
        this.options = Object.assign(Object.assign(Object.assign({}, defaultOptions_1.default), options), { borders: options.borders ? Object.assign(Object.assign({}, borders), options.borders) : borders, header: options.header ? Object.assign(Object.assign({}, header), options.header) : header, cell: options.cell ? Object.assign(Object.assign({}, cell), options.cell) : cell, fader: options.fader ? Object.assign(Object.assign({}, fader), options.fader) : fader, padding: padding, subtitle: options.subtitle
                ? Object.assign(Object.assign({}, subtitle), options.subtitle) : subtitle, title: options.title ? Object.assign(Object.assign({}, title), options.title) : title, watermark: options.watermark
                ? Object.assign(Object.assign({}, watermark), options.watermark) : watermark });
    }
    throwErrorIfNotGenerated() {
        if (!this.isGenerated) {
            throw new Error(CanvasTable.NOT_GENERATED_ERROR_MESSAGE);
        }
    }
}
exports.CanvasTable = CanvasTable;
CanvasTable.ELLIPSIS = "…";
CanvasTable.NOT_AVAILABLE_ON_BROWSER = "Not available on browser";
CanvasTable.NOT_AVAILABLE_ON_NODE = "Not available on node";
CanvasTable.NOT_GENERATED_ERROR_MESSAGE = "CanvasTable has not been generated. Please call generateTable() first.";
CanvasTable.TRANSPARENT_COLOR = !isNode
    ? "rgba(255,255,255,0)"
    : "transparent";
//# sourceMappingURL=index.js.map