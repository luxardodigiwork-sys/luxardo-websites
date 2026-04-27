const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // We only process if it imports storage or uses storage
    if (content.includes('storage.') || content.includes('storage} from')) {
        // imports
        content = content.replace(/import \{ storage \} from ['"][^'"]*utils\/localStorage['"];?/g, 'import { useStore } from "@/store";');
        content = content.replace(/([^a-zA-Z0-9])storage\.getProducts\(\)/g, '$1useStore(s => s.products)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getOrders\(\)/g, '$1useStore(s => s.orders)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getUsers\(\)/g, '$1useStore(s => s.users)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getSiteContent\(\)/g, '$1useStore(s => s.siteContent)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getPrimeContent\(\)/g, '$1useStore(s => s.primeContent)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getPrimeGlobalSettings\(\)/g, '$1useStore(s => s.primeGlobalSettings)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getPolicies\(\)/g, '$1useStore(s => s.policies)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getBespokeRequests\(\)/g, '$1useStore(s => s.bespokeRequests)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getWholesaleInquiries\(\)/g, '$1useStore(s => s.wholesaleInquiries)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getContactMessages\(\)/g, '$1useStore(s => s.contactMessages)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getDashboardStats\(\)/g, '$1useStore(s => s.getDashboardStats())');
        content = content.replace(/([^a-zA-Z0-9])storage\.getMedia\(\)/g, '$1useStore(s => s.media)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getBackendUsers\(\)/g, '$1useStore(s => s.backendUsers)');
        content = content.replace(/([^a-zA-Z0-9])storage\.getBackendSettings\(\)/g, '$1useStore(s => s.backendSettings)');

        content = content.replace(/([^a-zA-Z0-9])storage\.saveProducts/g, '$1useStore.getState().saveProducts');
        content = content.replace(/([^a-zA-Z0-9])storage\.saveOrders/g, '$1useStore.getState().saveOrders');
        content = content.replace(/([^a-zA-Z0-9])storage\.addOrder/g, '$1useStore.getState().addOrder');
        content = content.replace(/([^a-zA-Z0-9])storage\.saveUsers/g, '$1useStore.getState().saveUsers');
        content = content.replace(/([^a-zA-Z0-9])storage\.updateUser/g, '$1useStore.getState().updateUser');
        content = content.replace(/([^a-zA-Z0-9])storage\.saveSiteContent/g, '$1useStore.getState().saveSiteContent');
        content = content.replace(/([^a-zA-Z0-9])storage\.savePrimeContent/g, '$1useStore.getState().savePrimeContent');
        content = content.replace(/([^a-zA-Z0-9])storage\.savePrimeGlobalSettings/g, '$1useStore.getState().savePrimeGlobalSettings');
        content = content.replace(/([^a-zA-Z0-9])storage\.savePolicies/g, '$1useStore.getState().savePolicies');
        content = content.replace(/([^a-zA-Z0-9])storage\.addBespokeRequest/g, '$1useStore.getState().addBespokeRequest');
        content = content.replace(/([^a-zA-Z0-9])storage\.addWholesaleInquiry/g, '$1useStore.getState().addWholesaleInquiry');
        content = content.replace(/([^a-zA-Z0-9])storage\.addContactMessage/g, '$1useStore.getState().addContactMessage');
        
        content = content.replace(/([^a-zA-Z0-9])storage\.saveMedia/g, '$1useStore.getState().saveMedia');
        content = content.replace(/([^a-zA-Z0-9])storage\.addMedia/g, '$1useStore.getState().addMedia');
        content = content.replace(/([^a-zA-Z0-9])storage\.updateMedia/g, '$1useStore.getState().updateMedia');
        content = content.replace(/([^a-zA-Z0-9])storage\.deleteMedia/g, '$1useStore.getState().deleteMedia');
        content = content.replace(/([^a-zA-Z0-9])storage\.replaceMediaUrl/g, '$1useStore.getState().replaceMediaUrl');
        
        content = content.replace(/([^a-zA-Z0-9])storage\.saveBackendUsers/g, '$1useStore.getState().saveBackendUsers');
        content = content.replace(/([^a-zA-Z0-9])storage\.saveBackendSettings/g, '$1useStore.getState().saveBackendSettings');
        content = content.replace(/([^a-zA-Z0-9])storage\.isAdminLoggedIn/g, '$1useStore.getState().isAdminLoggedIn');
        content = content.replace(/([^a-zA-Z0-9])storage\.loginAdmin/g, '$1useStore.getState().loginAdmin');
        content = content.replace(/([^a-zA-Z0-9])storage\.logoutAdmin/g, '$1useStore.getState().logoutAdmin');
        content = content.replace(/([^a-zA-Z0-9])storage\.getSavedAddress/g, '$1useStore.getState().getSavedAddress');
        content = content.replace(/([^a-zA-Z0-9])storage\.saveAddress/g, '$1useStore.getState().saveAddress');

        if (content !== original) {
             // Make sure useStore is imported 
            if (!content.includes('useStore')) {
                content = "import { useStore } from '@/store';\n" + content;
            }
            // Fix alias issue if any 
             content = content.replace(/@\/store/g, '../../store'); // a temporary fallback logic
            // Since depths can vary, we will define a TS alias in vite/tsconfig, but we already have `@` alias in Vite config!
            // Wait, Vite config has `@: path.resolve(__dirname, '.')` which means `@/src/store`.
            content = content.replace(/import \{ useStore \} from ['"]\.\.\/\.\.\/store['"]/g, 'import { useStore } from "@/src/store";');
            content = content.replace(/import \{ useStore \} from ['"]@\/store['"]/g, 'import { useStore } from "@/src/store";');

            fs.writeFileSync(file, content);
            console.log(`Updated ${file}`);
        }
    }
});
