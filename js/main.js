import { initializeMap } from './map.js';
import { createBaseLayers, createOverlayLayers } from './layers.js';
import { addLayerControl } from './controls.js';
import { com_AE, COM_OBITO, SEM_AE, refem, vitimizacao, danos_colaterais } from './dados.js';

// Variável global para armazenar a última coordenada clicada para o Street View
let ultimaCoordenadaClicada = null;

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. INICIALIZAÇÃO DO MAPA E CAMADAS ---
    const map = initializeMap('map');
    const baseLayers = createBaseLayers();
    const overlayLayers = createOverlayLayers();

    baseLayers["OpenStreetMap"].addTo(map);

    Object.values(overlayLayers).forEach(grupo => {
        grupo.addTo(map);
        grupo.eachLayer(marker => {
            marker.on('click', function (e) {
                ultimaCoordenadaClicada = e.latlng;
            });
        });
    });

    // Pega as referências dos elementos do HTML
    const resetButton = document.getElementById('resete-mapa');
    const dateFilterButton = document.getElementById('date-filter-btn');
    const aispListContainer = document.getElementById('aisp-list');
    const aispApplyButton = document.getElementById('aisp-apply-btn');
    const aispSearchInput = document.getElementById('aisp-search-input');

    // ADICIONADO: Referência para filtro de prioridade
    const priorityListContainer = document.getElementById('priority-list');
    const priorityApplyButton = document.getElementById('priority-apply-btn');

    // --- 2. CRIAÇÃO E GERENCIAMENTO DOS FILTROS ---
    const todosOsPontos = [...com_AE, ...COM_OBITO, ...SEM_AE, ...vitimizacao, ...danos_colaterais, ...refem ];
    
    // ---- Filtro de AISP ----
    const todasAsAisps = todosOsPontos.map(ocorrencia => ocorrencia.aisp);
    const aispsUnicas = [...new Set(todasAsAisps)].sort();

    aispsUnicas.forEach(aisp => {
        if (aisp) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'aisp-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = aisp;
            checkbox.value = aisp;
            const label = document.createElement('label');
            label.htmlFor = aisp;
            label.textContent = aisp;
            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            aispListContainer.appendChild(itemDiv);
        }
    });

    // ---- Filtro de Prioridade ----
    const tiposPrioridadeUnicos = [...new Set(todosOsPontos.map(p => p.tipo_prioridade).filter(Boolean))].sort();

    tiposPrioridadeUnicos.forEach(tipo => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'priority-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = tipo;
        checkbox.value = tipo;
        const label = document.createElement('label');
        label.htmlFor = tipo;
        label.textContent = tipo;
        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(label);
        priorityListContainer.appendChild(itemDiv);
    });

    // --- LÓGICA PARA FILTRAR A LISTA DE CHECKBOXES DE AISP ---
    aispSearchInput.addEventListener('input', () => {
        const searchTerm = aispSearchInput.value.toLowerCase();
        const aispItems = aispListContainer.getElementsByClassName('aisp-item');
        Array.from(aispItems).forEach(item => {
            const label = item.querySelector('label');
            const aispName = label.textContent.toLowerCase();
            if (aispName.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // --- 3. LÓGICA DE FILTRAGEM E RESET ---
    function mostrarTodasAsCamadas() {
        Object.values(overlayLayers).forEach(grupo => {
            grupo.eachLayer(layer => {
                layer.addTo(map);
            });
        });
    }

    function filtrarCamadasPorMunicipio(nomeMunicipio) {
        mostrarTodasAsCamadas();
        const municipioFiltrar = nomeMunicipio.split(',')[0].trim();
        let pontosVisiveis = 0;

        Object.values(overlayLayers).forEach(grupo => {
            grupo.eachLayer(layer => {
                const localizacaoDoPonto = layer.feature.properties.localizacao.split(',')[0].trim();
                if (localizacaoDoPonto.toLowerCase() === municipioFiltrar.toLowerCase()) {
                    pontosVisiveis++;
                } else {
                    layer.removeFrom(map);
                }
            });
        });

        if (resetButton) resetButton.style.display = 'block';
        alert(`Exibindo ${pontosVisiveis} pontos para ${municipioFiltrar}.`);
    }

    function filtrarCamadasPorData() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        if (!startDate || !endDate) {
            alert("Por favor, selecione uma data de início e uma data de fim.");
            return;
        }

        let pontosVisiveis = 0;
        Object.values(overlayLayers).forEach(grupo => {
            grupo.eachLayer(layer => {
                if (layer.feature && layer.feature.properties && layer.feature.properties.data) {
                    if (map.hasLayer(layer)) {
                        const dataDoPonto = layer.feature.properties.data;
                        if (dataDoPonto >= startDate && dataDoPonto <= endDate) {
                            pontosVisiveis++;
                        } else {
                            layer.removeFrom(map);
                        }
                    }
                }
            });
        });

        if (resetButton) resetButton.style.display = 'block';
        alert(`Filtro de data aplicado. Exibindo ${pontosVisiveis} pontos.`);
    }

    function aplicarFiltroAISP() {
        const checkboxesMarcados = document.querySelectorAll('#aisp-list input:checked');
        const aispsSelecionadas = Array.from(checkboxesMarcados).map(cb => cb.value);
        mostrarTodasAsCamadas();

        if (aispsSelecionadas.length === 0) {
            resetarFiltro(true);
            return;
        }

        const layersFiltrados = [];
        Object.values(overlayLayers).forEach(grupo => {
            grupo.eachLayer(layer => {
                if (aispsSelecionadas.includes(layer.feature.properties.aisp)) {
                    layersFiltrados.push(layer);
                } else {
                    layer.removeFrom(map);
                }
            });
        });

        if (layersFiltrados.length > 0) {
            const grupoParaZoom = L.featureGroup(layersFiltrados);
            map.fitBounds(grupoParaZoom.getBounds().pad(0.1));
        }

        alert(`Exibindo ${layersFiltrados.length} pontos para as AISPs selecionadas.`);
        if (resetButton) resetButton.style.display = 'block';
    }

    // --- NOVO: filtro por prioridade ---
    function aplicarFiltroPrioridade() {
        const checkboxesMarcados = document.querySelectorAll('#priority-list input:checked');
        const prioridadesSelecionadas = Array.from(checkboxesMarcados).map(cb => cb.value);
        mostrarTodasAsCamadas();

        if (prioridadesSelecionadas.length === 0) {
            resetarFiltro(true);
            return;
        }

        const layersFiltrados = [];
        Object.values(overlayLayers).forEach(grupo => {
            grupo.eachLayer(layer => {
                if (prioridadesSelecionadas.includes(layer.feature.properties.tipo_prioridade)) {
                    layersFiltrados.push(layer);
                } else {
                    layer.removeFrom(map);
                }
            });
        });

        if (layersFiltrados.length > 0) {
            const grupoParaZoom = L.featureGroup(layersFiltrados);
            map.fitBounds(grupoParaZoom.getBounds().pad(0.1));
        }

        alert(`Exibindo ${layersFiltrados.length} pontos para as prioridades selecionadas.`);
        if (resetButton) resetButton.style.display = 'block';
    }

    function resetarFiltro(mostrarAlerta = true) {
        mostrarTodasAsCamadas();
        if (resetButton) resetButton.style.display = 'none';
        
        document.getElementById('start-date').value = '';
        document.getElementById('end-date').value = '';
        document.querySelectorAll('#aisp-list input:checked').forEach(cb => cb.checked = false);
        document.querySelectorAll('#priority-list input:checked').forEach(cb => cb.checked = false);

        if (mostrarAlerta) alert("Todos os filtros foram removidos.");
    }

    // --- 4. EVENT LISTENERS PARA OS BOTÕES E FILTROS ---
    if (resetButton) {
        resetButton.addEventListener('click', () => resetarFiltro(true));
    }
    
    if (dateFilterButton) {
        dateFilterButton.addEventListener('click', filtrarCamadasPorData);
    }
    
    if (aispApplyButton) {
        aispApplyButton.addEventListener('click', aplicarFiltroAISP);
    }

    if (priorityApplyButton) {
        priorityApplyButton.addEventListener('click', aplicarFiltroPrioridade);
    }
    
    // --- 5. CONTROLES DO MAPA ---
    addLayerControl(map, baseLayers, overlayLayers);

    L.Control.geocoder({
        position: 'topright',
        placeholder: 'Buscar município...',
        errorMessage: 'Local não encontrado.',
        geocoder: L.Control.Geocoder.nominatim({
            geocodingQueryParams: { "countrycodes": "br", "viewbox": "-46.6,-18.3,-37.3,-2.8" }
        }),
        defaultMarkGeocode: false
    })
    .on('markgeocode', function(e) {
        map.fitBounds(e.geocode.bbox);
        filtrarCamadasPorMunicipio(e.geocode.name);
    })
    .addTo(map);

    L.Control.StreetViewButton = L.Control.extend({
        onAdd: function (map) {
            const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
            btn.innerHTML = '📷';
            btn.title = 'Abrir Google Street View no último ponto clicado';
            btn.style.backgroundColor = 'white';
            btn.style.width = '34px';
            btn.style.height = '34px';
            btn.style.cursor = 'pointer';
            btn.onclick = function () {
                if (!ultimaCoordenadaClicada) {
                    alert("Clique em um ponto no mapa primeiro.");
                    return;
                }
                const lat = ultimaCoordenadaClicada.lat;
                const lng = ultimaCoordenadaClicada.lng;
                const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
                window.open(url, '_blank');
            };
            return btn;
        },
        onRemove: function () {}
    });
    L.control.streetViewButton = function (opts) {
        return new L.Control.StreetViewButton(opts);
    };
    L.control.streetViewButton({ position: 'topleft' }).addTo(map);

    // --- 6. INICIALIZAÇÃO DO CHATBOT ---
    // ADICIONADO: Chama a função do chatbot, passando todos os dados para ele.
});
