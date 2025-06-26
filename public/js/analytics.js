document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('table-body');
    const summaryCards = document.getElementById('summary-cards');
    const searchInput = document.getElementById('search-input');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const runAnalysisBtn = document.getElementById('run-analysis-btn');

    let analyticsData = [];
    let filteredData = [];
    let sortColumn = 'metrics.total_orders';
    let sortDirection = 'desc';
    let currentPage = 1;
    const rowsPerPage = 10;

    const fetchData = async (forceRun = false) => {
        try {
            const url = forceRun ? '/api/analytics/run' : '/api/analytics/all';
            const method = forceRun ? 'POST' : 'GET';
            
            showLoading(forceRun);

            const response = await fetch(url, { method });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            analyticsData = result.data.analytics || [];
            filteredData = [...analyticsData];
            
            renderSummary(result.data.summary);
            sortData();
            renderTable();
        } catch (error) {
            console.error('Failed to load data:', error);
            showErrorState();
        } finally {
            hideLoading();
        }
    };

    const renderSummary = (summary) => {
        summaryCards.innerHTML = `
            <div class="summary-card">
                <h3>Total Items</h3>
                <p>${summary.total_items || 0}</p>
            </div>
            <div class="summary-card">
                <h3>Total Order Lines</h3>
                <p>${(summary.total_order_lines || 0).toLocaleString()}</p>
            </div>
            <div class="summary-card">
                <h3>Avg. Orders / Item</h3>
                <p>${(summary.avg_orders_per_item || 0).toFixed(1)}</p>
            </div>
            <div class="summary-card">
                <h3>Most Popular Item</h3>
                <p>${summary.most_popular_item?.name || 'N/A'}</p>
            </div>
        `;
    };

    const renderTable = () => {
        tableBody.innerHTML = '';
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const paginatedData = filteredData.slice(start, end);

        if (paginatedData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No data available.</td></tr>';
            updatePaginationControls();
            return;
        }

        paginatedData.forEach(item => {
            const mainRow = document.createElement('tr');
            mainRow.dataset.itemId = item.item_id;
            mainRow.innerHTML = `
                <td class="col-icon">
                    <i class="fas fa-chevron-right toggle-details"></i>
                </td>
                <td class="col-item">${item.metadata.item_name || 'N/A'}</td>
                <td class="col-supplier">${item.metadata.supplier_id || 'N/A'}</td>
                <td class="col-orders">${item.metrics.total_orders || 0}</td>
                <td class="col-avg">${(item.metrics.avg_quantity || 0).toFixed(2)}</td>
                <td class="col-min-max">${item.metrics.min_quantity || 0} / ${item.metrics.max_quantity || 0}</td>
            `;

            const detailsRow = document.createElement('tr');
            detailsRow.classList.add('details-row');
            detailsRow.innerHTML = `<td colspan="6" class="details-cell"></td>`;
            
            tableBody.appendChild(mainRow);
            tableBody.appendChild(detailsRow);
        });

        updatePaginationControls();
    };
    
    const toggleDetails = (e) => {
        if (!e.target.classList.contains('toggle-details')) return;

        const mainRow = e.target.closest('tr');
        const detailsRow = mainRow.nextElementSibling;
        const itemId = mainRow.dataset.itemId;

        mainRow.classList.toggle('expanded');
        
        if (mainRow.classList.contains('expanded') && !detailsRow.dataset.loaded) {
            const itemData = analyticsData.find(d => d.item_id === itemId);
            if (itemData) {
                const detailsCell = detailsRow.querySelector('.details-cell');
                detailsCell.innerHTML = `
                    <div class="details-container">
                        ${generateBreakdownTable('By Location', itemData.breakdowns.by_location, ['Location ID', 'Min Qty', 'Max Qty'])}
                        ${generateBreakdownTable('By Day of Week', itemData.breakdowns.by_day_of_week, ['Day', 'Min Qty', 'Max Qty'])}
                        ${generateLocationPeriodTable(itemData.breakdowns.by_location_period)}
                    </div>
                `;
                detailsRow.dataset.loaded = 'true';
            }
        }
    };

    const generateBreakdownTable = (title, data, headers) => {
        if (!data || Object.keys(data).length === 0) {
            return '<div class="breakdown-table-container"><h4>' + title + '</h4><p style="padding: 16px;">No breakdown data available.</p></div>';
        }
    
        const tableRows = Object.entries(data).map(([key, value]) => `
            <tr>
                <td>${key}</td>
                <td>${value.min}</td>
                <td>${value.max}</td>
            </tr>
        `).join('');
    
        return `
            <div class="breakdown-table-container">
                <h4>${title}</h4>
                <table class="breakdown-table">
                    <thead>
                        <tr>
                            <th>${headers[0]}</th>
                            <th style="text-align: right;">${headers[1]}</th>
                            <th style="text-align: right;">${headers[2]}</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
    };

    const generateLocationPeriodTable = (data) => {
        if (!data || Object.keys(data).length === 0) {
            return '<div class="breakdown-table-container"><h4>By Location & Weekday/Weekend</h4><p style="padding: 16px;">No breakdown data available.</p></div>';
        }
        let rows = '';
        Object.entries(data).forEach(([locationId, periods]) => {
            ['Weekday', 'Weekend'].forEach(period => {
                const stats = periods[period];
                if (stats) {
                    rows += `<tr><td>${locationId}</td><td>${period}</td><td>${stats.min}</td><td>${stats.max}</td></tr>`;
                }
            });
        });
        return `
            <div class="breakdown-table-container">
                <h4>By Location & Weekday/Weekend</h4>
                <table class="breakdown-table">
                    <thead>
                        <tr>
                            <th>Location ID</th>
                            <th>Period</th>
                            <th style="text-align: right;">Min Qty</th>
                            <th style="text-align: right;">Max Qty</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    };

    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    const sortData = () => {
        filteredData.sort((a, b) => {
            const valA = getNestedValue(a, sortColumn) || 0;
            const valB = getNestedValue(b, sortColumn) || 0;
            
            if (typeof valA === 'string') {
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return sortDirection === 'asc' ? valA - valB : valB - valA;
            }
        });
        updateSortIndicators();
    };

    const updateSortIndicators = () => {
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
            if (th.dataset.sort === sortColumn) {
                th.classList.add(sortDirection);
            }
        });
    };
    
    const updatePaginationControls = () => {
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);
        pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    };
    
    // --- Event Listeners ---
    
    document.querySelector('.data-table thead').addEventListener('click', (e) => {
        const th = e.target.closest('.sortable');
        if (!th) return;

        const newSortColumn = th.dataset.sort;
        if (sortColumn === newSortColumn) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = newSortColumn;
            sortDirection = 'desc';
        }
        
        currentPage = 1;
        sortData();
        renderTable();
    });

    tableBody.addEventListener('click', toggleDetails);

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        filteredData = analyticsData.filter(item => 
            (item.metadata.item_name || '').toLowerCase().includes(searchTerm) ||
            (item.item_id || '').toLowerCase().includes(searchTerm)
        );
        currentPage = 1;
        sortData();
        renderTable();
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });
    
    runAnalysisBtn.addEventListener('click', () => fetchData(true));

    function showLoading(isFullAnalysis) {
        runAnalysisBtn.disabled = true;
        runAnalysisBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Running Analysis...';

        if (!isFullAnalysis) {
             tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">Loading data...</td></tr>';
        }
    }

    function hideLoading() {
        runAnalysisBtn.disabled = false;
        runAnalysisBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Run New Analysis';
    }

    function showErrorState() {
        summaryCards.innerHTML = '<p>Could not load summary data.</p>';
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #de350b;">Failed to load data. Please try running a new analysis or check the server logs.</td></tr>';
    }

    // Initial data fetch
    fetchData();
}); 