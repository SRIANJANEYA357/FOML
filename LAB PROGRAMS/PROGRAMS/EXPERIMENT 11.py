import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix


data = pd.read_csv("train.csv", low_memory=False)

print(data.head())


data = data.drop(['ID', 'Customer_ID', 'Name', 'SSN'], axis=1)


data = data.replace(['_', 'NA', 'nan'], pd.NA)


X = data.drop("Credit_Score", axis=1)

y = data["Credit_Score"]


label = LabelEncoder()

y = label.fit_transform(y)


numeric_columns = X.select_dtypes(include=['int64', 'float64']).columns

categorical_columns = X.select_dtypes(include=['object', 'string']).columns


numeric_pipeline = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler())
])


categorical_pipeline = Pipeline([
    ('imputer', SimpleImputer(strategy='most_frequent')),
    ('encoder', OneHotEncoder(handle_unknown='ignore'))
])


preprocessor = ColumnTransformer([
    ('num', numeric_pipeline, numeric_columns),
    ('cat', categorical_pipeline, categorical_columns)
])


model = Pipeline([
    ('preprocessor', preprocessor),
    ('classifier', RandomForestClassifier(
        n_estimators=50,
        random_state=42,
        n_jobs=-1
    ))
])


X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)


model.fit(X_train, y_train)


y_pred = model.predict(X_test)


print("\nAccuracy:")
print(accuracy_score(y_test, y_pred) * 100)


print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))


sample = X_test.iloc[[0]]

prediction = model.predict(sample)


print("\nPrediction:")
print(label.inverse_transform(prediction)[0])
