d3.csv("landsbanki_sek_isk.csv", function (error, transactions) {

    // Various formatters.
    var formatNumber = d3.format(",d"),
        formatDate = d3.time.format("%d %B %Y"),
        formatTime = d3.time.format("%H:%M:%S");

    var formatAverage = d3.format(".8f");

    // A nest operator, for grouping the transaction list.
    var nestByDate = d3.nest()
        .key(function (d) {
            return d3.time.day(d.date);
        });

    // A little coercion, since the CSV is untyped.
    transactions.forEach(function (d, i) {
        d.index = i;
        d.date = parseDate(d.date);
        d.exchange_rate = +d.exchange_rate;
    });


    // Create the crossfilter for the relevant dimensions and groups.
    var transaction = crossfilter(transactions),
        all = transaction.groupAll(),
        date = transaction.dimension(function (d) {
            return d.date;
        }),
        dates = date.group(d3.time.day),

        hour = transaction.dimension(function (d) {
            return d.date.getHours() + d.date.getMinutes() / 60;
        }),
        // hours = hour.group(Math.floor),
        hours = hour.group(),

        exchange_rate = transaction.dimension(function (d) {
            return d.exchange_rate;
        }),
        exchange_rates = exchange_rate.group(function (d) {
            return d;
        });

    var exchange_rate_sum = transaction.groupAll().reduceSum(function (d) {
        return d.exchange_rate;
    })
    


    var charts = [

        barChart()
            .dimension(hour)
            .group(hours)
                .x(d3.scale.linear()
                .domain([8, 20])
                .rangeRound([0, 10 * 90])),

        barChart()
            .dimension(exchange_rate)
            .group(exchange_rates)
            .x(d3.scale.linear()
                .domain([6, 22])
                .rangeRound([0, 10 * 90])),

        barChart()
            .dimension(date)
            .group(dates)
            .round(d3.time.day.round)
            .x(d3.time.scale()
                .domain([new Date(2002, 08, 1), new Date()])
                .rangeRound([0, 10 * 90]))
            .filter([new Date(2005, 1, 1), new Date()])

    ];

    // Given our array of charts, which we assume are in the same order as the
    // .chart elements in the DOM, bind the charts to the DOM and render them.
    // We also listen to the chart's brush events to update the display.
    var chart = d3.selectAll(".chart")
        .data(charts)
        .each(function (chart) {
            chart.on("brush", renderAll).on("brushend", renderAll);
        });

    // Render the initial lists.
    var list = d3.selectAll(".list")
        .data([transactionList]);

    // Render the total.
    d3.selectAll("#total")
        .text(formatNumber(transaction.size()));

    renderAll();

    // Renders the specified chart or list.
    function render(method) {
        d3.select(this).call(method);
    }

    // Whenever the brush moves, re-rendering everything.
    function renderAll() {
        chart.each(render);
        list.each(render);
        
        d3.select("#active").text(formatNumber(all.value()));
        
        console.log(exchange_rate_sum.value())
        var averageRate = exchange_rate_sum.value() / all.value();
        if (averageRate === Infinity || averageRate === -Infinity) {
            d3.select("#average").text("No values selected");
        } else {
            d3.select("#average").text(formatAverage(averageRate));
        }

    }

    function parseDate(d) {
        return new Date(d);
    }

    window.filter = function (filters) {
        filters.forEach(function (d, i) {
            charts[i].filter(d);
        });
        renderAll();
    };

    window.reset = function (i) {
        charts[i].filter(null);
        renderAll();
    };

    function transactionList(div) {
        var transactionsByDate = nestByDate.entries(date.top(100));

        div.each(function () {
            var date = d3.select(this).selectAll(".date")
                .data(transactionsByDate, function (d) {
                    return d.key;
                });

            date.enter().append("div")
                .attr("class", "date")
                .append("div")
                .attr("class", "day")
                .text(function (d) {
                    return formatDate(d.values[0].date);
                });

            date.exit().remove();

            var transaction = date.order().selectAll(".transaction")
                .data(function (d) {
                    return d.values;
                }, function (d) {
                    return d.index;
                });

            var transactionEnter = transaction.enter().append("div")
                .attr("class", "transaction");

            transactionEnter.append("div")
                .attr("class", "time")
                .text(function (d) {
                    return formatTime(d.date);
                });

            transactionEnter.append("div")
                .attr("class", "exchange_rate")
                .text(function (d) {
                    return d.exchange_rate;
                });

            transaction.exit().remove();

            transaction.order();
        });
    }

    function barChart() {
        if (!barChart.id) barChart.id = 0;

        var margin = {
            top: 10,
            right: 10,
            bottom: 50,
            left: 10
        },
            x,
            y = d3.scale.linear().range([100, 0]),
            id = barChart.id++,
            axis = d3.svg.axis().orient("bottom"),
            brush = d3.svg.brush(),
            brushDirty,
            dimension,
            group,
            round;

        function chart(div) {
            var width = x.range()[1],
                height = y.range()[0];

            y.domain([0, group.top(1)[0].value]);

            div.each(function () {
                var div = d3.select(this),
                    g = div.select("g");

                // Create the skeletal chart.
                if (g.empty()) {
                    div.select(".title").append("a")
                        .attr("href", "javascript:reset(" + id + ")")
                        .attr("class", "reset")
                        .text("reset")
                        .style("display", "none");

                    g = div.append("svg")
                        .attr("width", width + margin.left + margin.right)
                        .attr("height", height + margin.top + margin.bottom)
                        .append("g")
                        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                    g.append("clipPath")
                        .attr("id", "clip-" + id)
                        .append("rect")
                        .attr("width", width)
                        .attr("height", height);

                    g.selectAll(".bar")
                        .data(["background", "foreground"])
                        .enter().append("path")
                        .attr("class", function (d) {
                            return d + " bar";
                        })
                        .datum(group.all());

                    g.selectAll(".foreground.bar")
                        .attr("clip-path", "url(#clip-" + id + ")");

                    g.append("g")
                        .attr("class", "axis")
                        .attr("transform", "translate(0," + height + ")")
                        .call(axis);

                    // Initialize the brush component with pretty resize handles.
                    var gBrush = g.append("g").attr("class", "brush").call(brush);
                    gBrush.selectAll("rect").attr("height", height);
                    gBrush.selectAll(".resize").append("path").attr("d", resizePath);
                }

                // Only redraw the brush if set externally.
                if (brushDirty) {
                    brushDirty = false;
                    g.selectAll(".brush").call(brush);
                    div.select(".title a").style("display", brush.empty() ? "none" : null);
                    if (brush.empty()) {
                        g.selectAll("#clip-" + id + " rect")
                            .attr("x", 0)
                            .attr("width", width);
                    } else {
                        var extent = brush.extent();
                        g.selectAll("#clip-" + id + " rect")
                            .attr("x", x(extent[0]))
                            .attr("width", x(extent[1]) - x(extent[0]));
                    }
                }

                g.selectAll(".bar").attr("d", barPath);
            });

            function barPath(groups) {
                var path = [],
                    i = -1,
                    n = groups.length,
                    d;
                while (++i < n) {
                    d = groups[i];
                    path.push("M", x(d.key), ",", height, "V", y(d.value), "h9V", height);
                }
                return path.join("");
            }

            function resizePath(d) {
                var e = +(d == "e"),
                    x = e ? 1 : -1,
                    y = height / 3;
                return "M" + (.5 * x) + "," + y +
                    "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6) +
                    "V" + (2 * y - 6) +
                    "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y) +
                    "Z" +
                    "M" + (2.5 * x) + "," + (y + 8) +
                    "V" + (2 * y - 8) +
                    "M" + (4.5 * x) + "," + (y + 8) +
                    "V" + (2 * y - 8);
            }
        }

        brush.on("brushstart.chart", function () {
            var div = d3.select(this.parentNode.parentNode.parentNode);
            div.select(".title a").style("display", null);
        });

        brush.on("brush.chart", function () {
            var g = d3.select(this.parentNode),
                extent = brush.extent();
            if (round) g.select(".brush")
                .call(brush.extent(extent = extent.map(round)))
                .selectAll(".resize")
                .style("display", null);
            g.select("#clip-" + id + " rect")
                .attr("x", x(extent[0]))
                .attr("width", x(extent[1]) - x(extent[0]));
            dimension.filterRange(extent);
        });

        brush.on("brushend.chart", function () {
            if (brush.empty()) {
                var div = d3.select(this.parentNode.parentNode.parentNode);
                div.select(".title a").style("display", "none");
                div.select("#clip-" + id + " rect").attr("x", null).attr("width", "100%");
                dimension.filterAll();
            }
        });

        chart.margin = function (_) {
            if (!arguments.length) return margin;
            margin = _;
            return chart;
        };

        chart.x = function (_) {
            if (!arguments.length) return x;
            x = _;
            axis.scale(x);
            brush.x(x);
            return chart;
        };

        chart.y = function (_) {
            if (!arguments.length) return y;
            y = _;
            return chart;
        };

        chart.dimension = function (_) {
            if (!arguments.length) return dimension;
            dimension = _;
            return chart;
        };

        chart.filter = function (_) {
            if (_) {
                brush.extent(_);
                dimension.filterRange(_);
            } else {
                brush.clear();
                dimension.filterAll();
            }
            brushDirty = true;
            return chart;
        };

        chart.group = function (_) {
            if (!arguments.length) return group;
            group = _;
            return chart;
        };

        chart.round = function (_) {
            if (!arguments.length) return round;
            round = _;
            return chart;
        };

        return d3.rebind(chart, brush, "on");
    }
});