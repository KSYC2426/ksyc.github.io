<?php
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_FILES["fileToUpload"])) {
    $target_dir = "uploads/";
    $target_file = $target_dir . basename($_FILES["fileToUpload"]["name"]);
    $uploadOk = 1;
    $message = '';
    
    // Check if file already exists
    if (file_exists($target_file)) {
        $message = "抱歉，文件已存在。";
        $uploadOk = 0;
    }
    
    // Check file size (5MB limit)
    if ($_FILES["fileToUpload"]["size"] > 5000000000) {
        $message = "抱歉，文件太大（超过5G）。";
        $uploadOk = 0;
    }
    
    // Check upload status
    if ($uploadOk == 1) {
        if (move_uploaded_file($_FILES["fileToUpload"]["tmp_name"], $target_file)) {
            $message = "文件 ". htmlspecialchars(basename($_FILES["fileToUpload"]["name"])). " 上传成功。";
        } else {
            $message = "上传文件时出错。";
            $uploadOk = 0;
        }
    }
    
    // Return JSON response for AJAX
    header('Content-Type: application/json');
    echo json_encode([
        'success' => $uploadOk,
        'message' => $message
    ]);
    exit;
}
?>

<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文件上传系统</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #fff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        h2 {
            color: #2c3e50;
            text-align: center;
            margin-bottom: 30px;
        }
        .upload-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .form-group label {
            font-weight: bold;
        }
        input[type="file"] {
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        input[type="submit"] {
            background-color: #3498db;
            color: white;
            padding: 12px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s;
        }
        input[type="submit"]:hover {
            background-color: #2980b9;
        }
        .progress-container {
            width: 100%;
            background-color: #f1f1f1;
            border-radius: 4px;
            margin-top: 10px;
            display: none;
        }
        .progress-bar {
            width: 0%;
            height: 30px;
            background-color: #4CAF50;
            border-radius: 4px;
            text-align: center;
            line-height: 30px;
            color: white;
            transition: width 0.3s;
        }
        .message {
            margin-top: 20px;
            padding: 10px;
            border-radius: 4px;
            text-align: center;
            display: none;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>文件上传系统</h2>
        
        <div id="messageContainer" class="message"></div>
        
        <form class="upload-form" action="upload.php" method="post" enctype="multipart/form-data" id="uploadForm">
            <div class="form-group">
                <label for="fileToUpload">选择上传文件:</label>
                <input type="file" name="fileToUpload" id="fileToUpload" required>
            </div>
            
            <div class="progress-container" id="progressContainer">
                <div class="progress-bar" id="progressBar">0%</div>
            </div>
            
            <input type="submit" value="上传文件" name="submit">
        </form>
    </div>

    <script>
        document.getElementById('uploadForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('fileToUpload');
            const progressContainer = document.getElementById('progressContainer');
            const progressBar = document.getElementById('progressBar');
            const messageContainer = document.getElementById('messageContainer');
            
            if (fileInput.files.length > 0) {
                // Reset UI
                messageContainer.style.display = 'none';
                progressContainer.style.display = 'block';
                progressBar.style.width = '0%';
                progressBar.textContent = '0%';
                
                // Create FormData object
                const formData = new FormData(this);
                
                // Create AJAX request
                const xhr = new XMLHttpRequest();
                
                // Progress event
                xhr.upload.addEventListener('progress', function(e) {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        progressBar.style.width = percentComplete + '%';
                        progressBar.textContent = Math.round(percentComplete) + '%';
                    }
                });
                
                // Load event (when upload completes)
                xhr.addEventListener('load', function() {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        
                        // Show message
                        messageContainer.textContent = response.message;
                        messageContainer.className = 'message ' + (response.success ? 'success' : 'error');
                        messageContainer.style.display = 'block';
                        
                        // Hide progress bar after 2 seconds
                        setTimeout(() => {
                            progressContainer.style.display = 'none';
                        }, 2000);
                        
                        // Reset form if successful
                        if (response.success) {
                            document.getElementById('uploadForm').reset();
                        }
                    } catch (e) {
                        messageContainer.textContent = '处理响应时出错';
                        messageContainer.className = 'message error';
                        messageContainer.style.display = 'block';
                    }
                });
                
                // Error event
                xhr.addEventListener('error', function() {
                    messageContainer.textContent = '上传过程中发生错误';
                    messageContainer.className = 'message error';
                    messageContainer.style.display = 'block';
                    progressContainer.style.display = 'none';
                });
                
                // Open and send request
                xhr.open('POST', 'upload.php', true);
                xhr.send(formData);
            }
        });
    </script>
</body>
</html>