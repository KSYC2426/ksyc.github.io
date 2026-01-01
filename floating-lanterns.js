/**
 * 飘动灯笼生成脚本
 * 自动创建4个飘动的灯笼，显示"新年快乐"
 */

(function() {
    'use strict';
    
    // 等待DOM加载完成
    function initFloatingLanterns() {
        const lanternContainers = document.querySelectorAll('.floating-lanterns');
        
        lanternContainers.forEach(container => {
            // 清除可能已存在的内容
            container.innerHTML = '';
            
            // 获取自定义文本，默认为"新年快乐"
            const text = container.getAttribute('data-text') || '新年快乐';
            const characters = text.split('');
            
            // 确保有4个字符，不足则循环使用
            const displayChars = [];
            for (let i = 0; i < 4; i++) {
                displayChars.push(characters[i % characters.length]);
            }
            
            // 创建4个灯笼
            for (let i = 0; i < 4; i++) {
                const lanternWrapper = document.createElement('div');
                lanternWrapper.className = 'lantern-wrapper';
                
                lanternWrapper.innerHTML = `
                    <div class="lantern-rope"></div>
                    <div class="lantern-hook"></div>
                    <div class="lantern">${displayChars[i]}</div>
                    <div class="lantern-tassel"></div>
                `;
                
                container.appendChild(lanternWrapper);
            }
        });
    }
    
    // DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFloatingLanterns);
    } else {
        initFloatingLanterns();
    }
    
    // 导出函数，以便外部调用
    window.initFloatingLanterns = initFloatingLanterns;
})();